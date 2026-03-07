defmodule OpenPartyWeb.RoomController do
  use OpenPartyWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias OpenApiSpex.Schema
  alias OpenParty.Rooms
  alias OpenPartyWeb.Schemas

  operation(:create,
    summary: "Create room",
    security: [%{"bearerAuth" => []}],
    request_body:
      {"Room create request", "application/json", Schemas.RoomCreateRequest, required: false},
    responses: %{
      201 => {"Room created", "application/json", Schemas.RoomResponse},
      401 => {"Unauthorized", "application/json", Schemas.ErrorResponse},
      422 => {"Unprocessable entity", "application/json", Schemas.ErrorResponse}
    }
  )

  operation(:show,
    summary: "Get room by id",
    security: [%{"bearerAuth" => []}],
    parameters: [
      id: [
        in: :path,
        description: "Room ID",
        required: true,
        schema: %Schema{type: :string, format: :uuid}
      ]
    ],
    responses: %{
      200 => {"Room", "application/json", Schemas.RoomResponse},
      401 => {"Unauthorized", "application/json", Schemas.ErrorResponse},
      404 => {"Not found", "application/json", Schemas.ErrorResponse}
    }
  )

  operation(:show_by_code,
    summary: "Get room by invite code",
    security: [%{"bearerAuth" => []}],
    parameters: [
      code: [in: :path, description: "Invite code", type: :string, required: true]
    ],
    responses: %{
      200 => {"Room", "application/json", Schemas.RoomResponse},
      401 => {"Unauthorized", "application/json", Schemas.ErrorResponse},
      404 => {"Not found", "application/json", Schemas.ErrorResponse}
    }
  )

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
