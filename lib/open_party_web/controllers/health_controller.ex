defmodule OpenPartyWeb.HealthController do
  use OpenPartyWeb, :controller

  def index(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
