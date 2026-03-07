defmodule OpenParty.RoomsTest do
  use OpenParty.DataCase

  alias OpenParty.Rooms
  alias OpenParty.Rooms.Room

  import OpenParty.AccountsFixtures
  import OpenParty.RoomsFixtures

  describe "rooms" do
    test "create_room/1 with valid data creates a room" do
      user = user_fixture()

      valid_attrs = %{
        title: "Test Room",
        creator_user_id: user.id,
        host_user_id: user.id
      }

      assert {:ok, %Room{} = room} = Rooms.create_room(valid_attrs)
      assert room.title == "Test Room"
      assert room.status == "active"
      assert room.creator_user_id == user.id
      assert room.host_user_id == user.id
      assert String.length(room.invite_code) == 6
    end

    test "create_room/1 generates a unique 6-char alphanumeric invite code" do
      user = user_fixture()
      attrs = %{creator_user_id: user.id, host_user_id: user.id}

      {:ok, room1} = Rooms.create_room(attrs)
      {:ok, room2} = Rooms.create_room(attrs)

      assert String.length(room1.invite_code) == 6
      assert String.length(room2.invite_code) == 6
      assert room1.invite_code =~ ~r/^[0-9A-Z]{6}$/
    end

    test "create_room/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Rooms.create_room(%{})
    end

    test "get_room!/1 returns the room with given id" do
      room = room_fixture()
      assert Rooms.get_room!(room.id) == room
    end

    test "get_room!/1 raises for unknown id" do
      assert_raise Ecto.NoResultsError, fn ->
        Rooms.get_room!(Ecto.UUID.generate())
      end
    end

    test "get_room_by_invite_code/1 returns {:ok, room} for valid code" do
      room = room_fixture()
      assert {:ok, found} = Rooms.get_room_by_invite_code(room.invite_code)
      assert found.id == room.id
    end

    test "get_room_by_invite_code/1 returns {:error, :not_found} for unknown code" do
      assert {:error, :not_found} = Rooms.get_room_by_invite_code("XXXXXX")
    end

    test "list_rooms_for_user/1 returns rooms created by user" do
      user = user_fixture()
      other_user = user_fixture()
      room = room_fixture(user)
      _other_room = room_fixture(other_user)

      rooms = Rooms.list_rooms_for_user(user.id)
      assert length(rooms) == 1
      assert hd(rooms).id == room.id
    end
  end
end
