defmodule OpenParty.RoomRegistry do
  def child_spec(_), do: Registry.child_spec(keys: :unique, name: __MODULE__)
  def via(room_id), do: {:via, Registry, {__MODULE__, room_id}}
end
