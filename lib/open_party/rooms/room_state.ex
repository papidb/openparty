defmodule OpenParty.Rooms.RoomState do
  @type playback_state :: :playing | :paused

  @enforce_keys [:room_id, :host_user_id]
  defstruct [
    :room_id,
    :host_user_id,
    :media_id,
    playback_state: :paused,
    base_position_ms: 0,
    last_updated_at_ms: 0,
    playback_rate: 1.0,
    revision: 0
  ]
end
