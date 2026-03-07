defmodule OpenPartyWeb.RoomControllerTest do
  use OpenPartyWeb.ConnCase

  alias OpenParty.Accounts

  import OpenParty.AccountsFixtures
  import OpenParty.RoomsFixtures

  defp auth_conn(conn, user) do
    token = Accounts.create_user_api_token(user)
    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  test "room creation works with valid bearer token", %{conn: conn} do
    user = user_fixture()
    conn = conn |> auth_conn(user) |> post(~p"/api/rooms", %{title: "Test Room"})
    assert %{"room_id" => room_id, "invite_code" => invite_code} = json_response(conn, 201)
    assert is_binary(room_id)
    assert String.length(invite_code) == 6
  end

  test "room creation requires auth", %{conn: conn} do
    conn = post(conn, ~p"/api/rooms", %{title: "Test Room"})
    assert response(conn, 401)
  end

  test "room fetch by ID works", %{conn: conn} do
    user = user_fixture()
    room = room_fixture(user)
    conn = conn |> auth_conn(user) |> get(~p"/api/rooms/#{room.id}")
    assert %{"room_id" => room_id} = json_response(conn, 200)
    assert room_id == room.id
  end

  test "room fetch 404 for unknown ID", %{conn: conn} do
    user = user_fixture()
    fake_id = Ecto.UUID.generate()
    conn = conn |> auth_conn(user) |> get(~p"/api/rooms/#{fake_id}")
    assert json_response(conn, 404)
  end

  test "room fetch by invite code works", %{conn: conn} do
    user = user_fixture()
    room = room_fixture(user)
    conn = conn |> auth_conn(user) |> get(~p"/api/rooms/code/#{room.invite_code}")
    assert %{"room_id" => room_id} = json_response(conn, 200)
    assert room_id == room.id
  end

  test "invite code 404 for unknown code", %{conn: conn} do
    user = user_fixture()
    conn = conn |> auth_conn(user) |> get(~p"/api/rooms/code/XXXXXX")
    assert json_response(conn, 404)
  end

  test "health endpoint returns ok", %{conn: conn} do
    conn = get(conn, ~p"/api/health")
    assert %{"status" => "ok"} = json_response(conn, 200)
  end
end
