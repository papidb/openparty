defmodule OpenPartyWeb.RoomChannelTest do
  use OpenParty.DataCase, async: false

  import Phoenix.ChannelTest
  import OpenParty.AccountsFixtures
  import OpenParty.RoomsFixtures

  alias OpenParty.{Accounts, RoomRegistry, RoomSupervisor}
  alias OpenPartyWeb.{RoomChannel, UserSocket}

  @endpoint OpenPartyWeb.Endpoint

  setup do
    unless Process.whereis(RoomRegistry) do
      start_supervised!({Registry, keys: :unique, name: RoomRegistry})
    end

    unless Process.whereis(RoomSupervisor) do
      start_supervised!({RoomSupervisor, []})
    end

    user = user_fixture()
    token = Accounts.create_user_api_token(user)
    room = room_fixture(user)

    {:ok, socket} = connect(UserSocket, %{"token" => token})

    {:ok, user: user, room: room, socket: socket}
  end

  test "client can join valid room channel", %{room: room, socket: socket} do
    assert {:ok, _, _channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")
  end

  test "join returns snapshot", %{room: room, socket: socket} do
    {:ok, _, _channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    assert_push "snapshot", snapshot
    assert Map.has_key?(snapshot, :room_id)
    assert Map.has_key?(snapshot, :playback_state)
    assert Map.has_key?(snapshot, :revision)
    assert Map.has_key?(snapshot, :base_position_ms)
  end

  test "play event updates room and broadcasts", %{room: room, socket: socket} do
    {:ok, _, channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    ref = push(channel_socket, "play", %{"position_ms" => 0})
    assert_reply ref, :ok, _snapshot
    assert_broadcast "playback_updated", %{playback_state: :playing}
  end

  test "pause event updates room and broadcasts", %{room: room, socket: socket} do
    {:ok, _, channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    ref = push(channel_socket, "pause", %{"position_ms" => 5000})
    assert_reply ref, :ok, _snapshot
    assert_broadcast "playback_updated", %{playback_state: :paused}
  end

  test "seek event updates room and broadcasts", %{room: room, socket: socket} do
    {:ok, _, channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    ref = push(channel_socket, "seek", %{"position_ms" => 30_000})
    assert_reply ref, :ok, snapshot
    assert snapshot.base_position_ms == 30_000
  end

  test "non-host command returns forbidden error", %{room: room, socket: socket} do
    {:ok, _, _channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    other_user = user_fixture()
    other_token = Accounts.create_user_api_token(other_user)
    {:ok, other_socket} = connect(UserSocket, %{"token" => other_token})

    {:ok, _, other_channel_socket} =
      subscribe_and_join(other_socket, RoomChannel, "room:#{room.id}")

    ref = push(other_channel_socket, "play", %{"position_ms" => 0})
    assert_reply ref, :error, %{code: "forbidden"}
  end

  test "request_snapshot returns current snapshot", %{room: room, socket: socket} do
    {:ok, _, channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")
    assert_push "snapshot", _snapshot

    ref = push(channel_socket, "request_snapshot", %{})
    assert_reply ref, :ok, snapshot
    assert Map.has_key?(snapshot, :room_id)
  end

  test "sync_check with large drift returns corrective snapshot", %{room: room, socket: socket} do
    {:ok, _, channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    play_ref = push(channel_socket, "play", %{"position_ms" => 0})
    assert_reply play_ref, :ok, _snapshot

    ref =
      push(channel_socket, "sync_check", %{"position_ms" => 99_999, "last_applied_revision" => 1})

    assert_reply ref, :ok, %{corrective_snapshot: snapshot}
    assert is_map(snapshot)
  end

  test "join fails for non-existent room", %{socket: socket} do
    fake_room_id = Ecto.UUID.generate()

    assert {:error, %{reason: "room_not_found"}} =
             subscribe_and_join(socket, RoomChannel, "room:#{fake_room_id}")
  end

  test "presence is tracked on join", %{room: room, user: user, socket: socket} do
    {:ok, _, _channel_socket} = subscribe_and_join(socket, RoomChannel, "room:#{room.id}")

    presences = OpenPartyWeb.Presence.list("room:#{room.id}")
    assert map_size(presences) > 0
    assert Map.has_key?(presences, user.id)
  end
end
