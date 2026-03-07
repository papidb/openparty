defmodule OpenParty.Rooms.Room do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "rooms" do
    field :title, :string
    field :status, :string, default: "active"
    field :invite_code, :string
    field :media_url, :string

    belongs_to :creator_user, OpenParty.Accounts.User,
      foreign_key: :creator_user_id,
      type: :binary_id

    belongs_to :host_user, OpenParty.Accounts.User,
      foreign_key: :host_user_id,
      type: :binary_id

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(room, attrs) do
    room
    |> cast(attrs, [:title, :status, :invite_code, :media_url, :creator_user_id, :host_user_id])
    |> validate_required([:status, :invite_code, :creator_user_id, :host_user_id])
    |> unique_constraint(:invite_code)
  end
end
