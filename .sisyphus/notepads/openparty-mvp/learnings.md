## [2026-03-07] T1: Scaffolding
Scaffolded Phoenix 1.8.5 in `/tmp/open_party` with `--no-mailer --no-dashboard --binary-id --no-gettext --install`, copied into repo root while preserving existing `.git/`, started `openparty-postgres` (`postgres:17-alpine`) on `localhost:5432`, and verified `mix deps.get`, `mix ecto.create`, `mix compile`, and `mix precommit` all succeeded.

## [2026-03-07] T2: CORS + Health
Added `{:corsica, "~> 2.0"}` in `mix.exs`, inserted `plug Corsica, origins: "*", allow_headers: :all` in `lib/open_party_web/endpoint.ex` immediately before `plug OpenPartyWeb.Router`, created `lib/open_party_web/controllers/health_controller.ex` with `index/2` returning `%{status: "ok"}`, and added `get "/health", HealthController, :index` under `scope "/api", OpenPartyWeb` with `pipe_through :api` in `lib/open_party_web/router.ex`; verified with `mix compile`, `mix phx.routes | grep health`, and `mix precommit`.

## [2026-03-07] T3: Auth
Generated auth via `echo "Y" | mix phx.gen.auth Accounts User users` (LiveView default), added required mail support (`:swoosh` dep, `OpenParty.Mailer`, and `config :swoosh, :api_client, false`) because this project started without mailer, migrated auth tables plus `add_display_name_to_users`, inserted the requested confirmation-disabled note block in `lib/open_party_web/router.ex`, and extended `OpenParty.Accounts.User` with `field :display_name, :string, default: ""` plus registration cast support in `email_changeset/3`; verified with `mix test` (111 tests, 0 failures) and `mix precommit`.
