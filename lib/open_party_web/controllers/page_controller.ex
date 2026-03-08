defmodule OpenPartyWeb.PageController do
  use OpenPartyWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end

  def demo_video(conn, _params) do
    render(conn, :demo_video)
  end
end
