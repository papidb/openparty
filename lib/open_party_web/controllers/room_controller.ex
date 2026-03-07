defmodule OpenPartyWeb.RoomController do
  use OpenPartyWeb, :controller

  alias OpenParty.Rooms

  def create(conn, params) do
    user = conn.assigns.current_scope.user

    attrs = %{
      title: params["title"],
      creator_user_id: user.id,
      host_user_id: user.id
    }

    case Rooms.create_room(attrs) do
      {:ok, room} ->
        conn
        |> put_status(:created)
        |> json(%{
          room_id: room.id,
          invite_code: room.invite_code,
          title: room.title,
          status: room.status
        })

      {:error, _changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to create room"})
    end
  end

  def show(conn, %{"id" => id}) do
    case Rooms.get_room(id) do
      {:ok, room} ->
        json(conn, %{
          room_id: room.id,
          invite_code: room.invite_code,
          title: room.title,
          status: room.status
        })

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Room not found"})
    end
  end

  def show_by_code(conn, %{"code" => code}) do
    case Rooms.get_room_by_invite_code(code) do
      {:ok, room} ->
        json(conn, %{
          room_id: room.id,
          invite_code: room.invite_code,
          title: room.title,
          status: room.status
        })

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Room not found"})
    end
  end
end
