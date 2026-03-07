defmodule OpenPartyWeb.UserSocket do
  use Phoenix.Socket

  channel "room:*", OpenPartyWeb.RoomChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case OpenParty.Accounts.fetch_user_by_api_token(token) do
      {:ok, user} ->
        {:ok,
         socket
         |> assign(:user_id, user.id)
         |> assign(:display_name, user.display_name)}

      _ ->
        {:error, %{reason: "unauthorized"}}
    end
  end

  def connect(_params, _socket, _connect_info) do
    {:error, %{reason: "unauthorized"}}
  end

  @impl true
  def id(socket), do: "users_socket:#{socket.assigns.user_id}"
end
