defmodule OpenPartyWeb.PageController do
  use OpenPartyWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
