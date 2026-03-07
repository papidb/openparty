defmodule OpenParty.RoomManager do
  alias OpenParty.{Rooms, RoomRegistry, RoomSupervisor}

  def start_or_get_room(room_id) do
    case Rooms.get_room(room_id) do
      {:ok, _room} ->
        case Registry.lookup(RoomRegistry, room_id) do
          [{pid, _}] ->
            {:ok, pid}

          [] ->
            case RoomSupervisor.start_room(room_id) do
              {:ok, pid} -> {:ok, pid}
              {:error, {:already_started, pid}} -> {:ok, pid}
              error -> error
            end
        end

      {:error, :not_found} ->
        {:error, :room_not_found}
    end
  end
end
