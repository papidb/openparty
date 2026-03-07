defmodule OpenParty.Rooms.RoomServerTest do
  use OpenParty.DataCase, async: false

  alias OpenParty.RoomRegistry
  alias OpenParty.Rooms.RoomServer

  import OpenParty.AccountsFixtures
  import OpenParty.RoomsFixtures

  setup do
    unless Process.whereis(RoomRegistry) do
      start_supervised!({Registry, keys: :unique, name: RoomRegistry})
    end

    user = user_fixture()
    room = room_fixture(user)

    {:ok, user: user, room: room}
  end

  test "initializes room state correctly", %{room: room} do
    start_supervised!({RoomServer, room.id})

    snapshot = RoomServer.get_snapshot(room.id)
    assert snapshot.playback_state == :paused
    assert snapshot.base_position_ms == 0
    assert snapshot.revision == 0
  end

  test "host can play", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})

    assert {:ok, snapshot} = RoomServer.play(room.id, user.id, 5000)
    assert snapshot.playback_state == :playing
    assert snapshot.base_position_ms == 5000
  end

  test "host can pause", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})
    RoomServer.play(room.id, user.id, 0)

    assert {:ok, snapshot} = RoomServer.pause(room.id, user.id, 5000)
    assert snapshot.playback_state == :paused
    assert snapshot.base_position_ms == 5000
  end

  test "host can seek", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})

    assert {:ok, snapshot} = RoomServer.seek(room.id, user.id, 30000)
    assert snapshot.base_position_ms == 30000
  end

  test "non-host cannot control playback", %{room: room} do
    start_supervised!({RoomServer, room.id})
    other_user = user_fixture()

    assert {:error, :forbidden} = RoomServer.play(room.id, other_user.id, 0)
  end

  test "revision increments on every valid update", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})

    {:ok, s1} = RoomServer.play(room.id, user.id, 0)
    assert s1.revision == 1

    {:ok, s2} = RoomServer.pause(room.id, user.id, 0)
    assert s2.revision == 2

    {:ok, s3} = RoomServer.seek(room.id, user.id, 1000)
    assert s3.revision == 3
  end

  test "snapshot computes current position correctly while playing", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})
    RoomServer.play(room.id, user.id, 0)
    Process.sleep(100)

    snapshot = RoomServer.get_snapshot(room.id)
    assert snapshot.base_position_ms >= 100
  end

  test "paused snapshot returns base position unchanged", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})
    RoomServer.pause(room.id, user.id, 5000)
    Process.sleep(100)

    snapshot = RoomServer.get_snapshot(room.id)
    assert snapshot.base_position_ms == 5000
  end

  test "sync_check returns in_sync for small drift", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})
    RoomServer.play(room.id, user.id, 0)

    assert {:ok, :in_sync} = RoomServer.sync_check(room.id, user.id, 100, 1)
  end

  test "sync_check returns corrective snapshot for large drift", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})
    RoomServer.play(room.id, user.id, 0)

    assert {:ok, {:corrective_snapshot, snapshot}} =
             RoomServer.sync_check(room.id, user.id, 99999, 1)

    assert is_map(snapshot)
  end

  test "invalid position_ms returns error", %{room: room, user: user} do
    start_supervised!({RoomServer, room.id})

    assert {:error, :invalid_position} = RoomServer.play(room.id, user.id, -1)
    assert {:error, :invalid_position} = RoomServer.pause(room.id, user.id, "bad")
  end
end
