defmodule OpenPartyWeb.TokenController do
  use OpenPartyWeb, :controller

  alias OpenParty.Accounts

  def create(conn, %{"email" => email, "password" => password}) do
    case Accounts.get_user_by_email_and_password(email, password) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid email or password"})

      user ->
        token = Accounts.create_user_api_token(user)
        json(conn, %{token: token})
    end
  end
end
