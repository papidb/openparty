defmodule OpenParty.Rooms do
  @moduledoc """
  The Rooms context.
  """

  import Ecto.Query, warn: false
  import Ecto.Changeset, only: [add_error: 3]

  alias OpenParty.Repo
  alias OpenParty.Rooms.Room

  @doc """
  Creates a room with an auto-generated invite code.
  """
  def create_room(attrs) do
    do_create_room(attrs, 0)
  end

  @doc """
  Gets a room by id and raises if not found.
  """
  def get_room!(id) do
    Repo.get!(Room, id)
  end

  @doc """
  Gets a room by id.
  """
  def get_room(id) do
    case Repo.get(Room, id) do
      %Room{} = room -> {:ok, room}
      nil -> {:error, :not_found}
    end
  end

  @doc """
  Gets a room by invite code.
  """
  def get_room_by_invite_code(code) do
    case Repo.get_by(Room, invite_code: code) do
      %Room{} = room -> {:ok, room}
      nil -> {:error, :not_found}
    end
  end

  @doc """
  Lists rooms created by a specific user.
  """
  def list_rooms_for_user(user_id) do
    from(r in Room, where: r.creator_user_id == ^user_id)
    |> Repo.all()
  end

  defp do_create_room(attrs, attempt) when attempt < 5 do
    invite_code = generate_invite_code()
    attrs_with_code = Map.put(attrs, :invite_code, invite_code)

    case %Room{} |> Room.changeset(attrs_with_code) |> Repo.insert() do
      {:ok, room} ->
        {:ok, room}

      {:error, changeset} ->
        if invite_code_collision?(changeset) do
          do_create_room(attrs, attempt + 1)
        else
          {:error, changeset}
        end
    end
  rescue
    Ecto.ConstraintError ->
      do_create_room(attrs, attempt + 1)
  end

  defp do_create_room(attrs, 5) do
    {:error,
     %Room{}
     |> Room.changeset(attrs)
     |> add_error(:invite_code, "could not generate unique invite code")}
  end

  defp invite_code_collision?(changeset) do
    Enum.any?(changeset.errors, fn
      {:invite_code, {_message, metadata}} -> Keyword.get(metadata, :constraint) == :unique
      _ -> false
    end)
  end

  defp generate_invite_code do
    for _ <- 1..6, into: "", do: <<Enum.random(~c"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")>>
  end
end
