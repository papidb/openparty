defmodule OpenParty.Repo do
  use Ecto.Repo,
    otp_app: :open_party,
    adapter: Ecto.Adapters.Postgres
end
