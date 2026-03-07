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

  @impl true
  def handle_in("play", %{"position_ms" => position_ms} = params, socket) do
    case RoomServer.play(
           socket.assigns.room_id,
           socket.assigns.user_id,
           position_ms,
           params["media_id"]
         ) do
      {:ok, snapshot} ->
        {:reply, {:ok, snapshot}, socket}

      {:error, :forbidden} ->
        {:reply, {:error, %{code: "forbidden", message: "Only the host can control playback"}},
         socket}

      {:error, :invalid_position} ->
        {:reply,
         {:error,
          %{code: "invalid_position", message: "position_ms must be a non-negative integer"}},
         socket}
    end
  end

  def handle_in("pause", %{"position_ms" => position_ms}, socket) do
    case RoomServer.pause(socket.assigns.room_id, socket.assigns.user_id, position_ms) do
      {:ok, snapshot} ->
        {:reply, {:ok, snapshot}, socket}

      {:error, :forbidden} ->
        {:reply, {:error, %{code: "forbidden", message: "Only the host can control playback"}},
         socket}

      {:error, :invalid_position} ->
        {:reply,
         {:error,
          %{code: "invalid_position", message: "position_ms must be a non-negative integer"}},
         socket}
    end
  end

  def handle_in("seek", %{"position_ms" => position_ms}, socket) do
    case RoomServer.seek(socket.assigns.room_id, socket.assigns.user_id, position_ms) do
      {:ok, snapshot} ->
        {:reply, {:ok, snapshot}, socket}

      {:error, :forbidden} ->
        {:reply, {:error, %{code: "forbidden", message: "Only the host can control playback"}},
         socket}

      {:error, :invalid_position} ->
        {:reply,
         {:error,
          %{code: "invalid_position", message: "position_ms must be a non-negative integer"}},
         socket}
    end
  end

  def handle_in("request_snapshot", _params, socket) do
    snapshot = RoomServer.get_snapshot(socket.assigns.room_id)
    {:reply, {:ok, snapshot}, socket}
  end

  def handle_in(
        "sync_check",
        %{"position_ms" => position_ms, "last_applied_revision" => revision},
        socket
      ) do
    result =
      RoomServer.sync_check(socket.assigns.room_id, socket.assigns.user_id, position_ms, revision)

    reply =
      case result do
        {:ok, :in_sync} ->
          {:ok, %{status: "in_sync"}}

        {:ok, {:minor_drift, drift}} ->
          {:ok, %{status: "minor_drift", drift_ms: drift}}

        {:ok, {:corrective_snapshot, snapshot}} ->
          {:ok, %{corrective_snapshot: snapshot}}

        {:error, :invalid_position} ->
          {:error,
           %{code: "invalid_position", message: "position_ms must be a non-negative integer"}}
      end

    {:reply, reply, socket}
  end

  def handle_in(event, _params, socket) when event in ["play", "pause", "seek"] do
    {:reply, {:error, %{code: "missing_field", message: "position_ms is required"}}, socket}
  end
end
