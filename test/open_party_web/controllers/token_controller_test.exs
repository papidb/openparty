defmodule OpenPartyWeb.TokenControllerTest do
  use OpenPartyWeb.ConnCase

  import OpenParty.AccountsFixtures

  test "token creation works with valid credentials", %{conn: conn} do
    user = user_fixture() |> set_password()
    conn = post(conn, ~p"/api/tokens", %{email: user.email, password: valid_user_password()})
    assert %{"token" => token} = json_response(conn, 200)
    assert is_binary(token)
  end

  test "token creation fails with wrong password", %{conn: conn} do
    user = user_fixture()
    conn = post(conn, ~p"/api/tokens", %{email: user.email, password: "wrong-password"})
    assert json_response(conn, 401)
  end

  test "token creation fails with unknown email", %{conn: conn} do
    conn = post(conn, ~p"/api/tokens", %{email: "nobody@example.com", password: "whatever"})
    assert json_response(conn, 401)
  end
end
