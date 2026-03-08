defmodule OpenPartyWeb.PageControllerTest do
  use OpenPartyWeb.ConnCase

  test "GET /", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert html_response(conn, 200) =~ "Peace of mind from prototype to production"
  end

  test "GET /demo-video", %{conn: conn} do
    conn = get(conn, ~p"/demo-video")
    body = html_response(conn, 200)

    assert body =~ "OpenParty Demo Video"
    assert body =~ "openparty-demo-video"
  end
end
