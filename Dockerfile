FROM elixir:1.19.3-otp-28-alpine AS builder

ENV MIX_ENV=prod
WORKDIR /app

RUN apk add --no-cache build-base git nodejs npm

COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force
RUN mix deps.get --only prod
RUN mix deps.compile

COPY config config/
COPY lib lib/
COPY priv priv/
COPY assets assets/

RUN mix compile
RUN mix assets.deploy
RUN mix phx.gen.release
RUN mix release

FROM alpine:3.21 AS runner

RUN apk add --no-cache libgcc libstdc++ ncurses-libs openssl

WORKDIR /app
COPY --from=builder /app/_build/prod/rel/open_party ./

EXPOSE 4000
ENV PHX_SERVER=true

CMD ["bin/open_party", "start"]
