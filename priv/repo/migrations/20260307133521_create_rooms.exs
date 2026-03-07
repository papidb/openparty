defmodule OpenParty.Repo.Migrations.CreateRooms do
  use Ecto.Migration

  def change do
    create table(:rooms, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title, :string
      add :status, :string, null: false, default: "active"
      add :invite_code, :string, null: false
      add :media_url, :string
      add :creator_user_id, references(:users, on_delete: :nothing, type: :binary_id)
      add :host_user_id, references(:users, on_delete: :nothing, type: :binary_id)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:rooms, [:invite_code])
    create index(:rooms, [:creator_user_id])
    create index(:rooms, [:host_user_id])
  end
end
