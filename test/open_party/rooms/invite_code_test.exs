defmodule OpenParty.Rooms.InviteCodeTest do
  use OpenParty.DataCase

  alias OpenParty.Rooms

  import OpenParty.AccountsFixtures

  test "full invite code flow: create room -> get code -> look up by code" do
    user = user_fixture()

    {:ok, room} =
      Rooms.create_room(%{
        creator_user_id: user.id,
        host_user_id: user.id,
        title: "Integration Test Room"
      })

    assert String.length(room.invite_code) == 6
    assert room.invite_code =~ ~r/^[0-9A-Z]{6}$/

    {:ok, found_room} = Rooms.get_room_by_invite_code(room.invite_code)
    assert found_room.id == room.id
    assert found_room.invite_code == room.invite_code
  end

  test "invite code is returned in room creation response shape" do
    user = user_fixture()

    {:ok, room} =
      Rooms.create_room(%{
        creator_user_id: user.id,
        host_user_id: user.id
      })

    assert room.id
    assert room.invite_code
    assert room.status == "active"
  end

  test "unknown invite code returns not_found" do
    assert {:error, :not_found} = Rooms.get_room_by_invite_code("XXXXXX")
  end
end
