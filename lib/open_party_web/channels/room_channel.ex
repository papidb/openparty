defmodule OpenPartyWeb.RoomChannel do
  use OpenPartyWeb, :channel

  alias OpenParty.RoomManager
  alias OpenParty.Rooms.RoomServer
  alias OpenPartyWeb.Presence

  @impl true
  def join("room:" <> room_id, _params, socket) do
    case RoomManager.start_or_get_room(room_id) do
      {:ok, _pid} ->
        send(self(), :after_join)
        {:ok, assign(socket, :room_id, room_id)}

      {:error, :room_not_found} ->
        {:error, %{reason: "room_not_found"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    room_id = socket.assigns.room_id

    {:ok, _} =
      Presence.track(socket, socket.assigns.user_id, %{
        display_name: socket.assigns.display_name,
        joined_at: System.system_time(:second)
      })

    push(socket, "snapshot", RoomServer.get_snapshot(room_id))
    {:noreply, socket}
  end
end
