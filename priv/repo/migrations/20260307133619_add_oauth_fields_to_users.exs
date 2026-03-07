defmodule OpenParty.Repo.Migrations.AddOauthFieldsToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :oauth_provider, :string, null: true
      add :oauth_uid, :string, null: true
    end
  end
end
