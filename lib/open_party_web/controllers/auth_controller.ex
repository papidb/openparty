defmodule OpenPartyWeb.AuthController do
  use OpenPartyWeb, :controller

  plug Ueberauth

  alias OpenParty.Accounts
  alias OpenPartyWeb.UserAuth

  def request(conn, _params) do
    redirect(conn, to: ~p"/users/log-in")
  end

  def callback(%{assigns: %{ueberauth_auth: %Ueberauth.Auth{} = auth}} = conn, _params) do
    case Accounts.find_or_create_from_oauth(auth) do
      {:ok, user} ->
        conn
        |> put_flash(:info, "Signed in with Google successfully.")
        |> UserAuth.log_in_user(user, %{})

      {:error, _reason} ->
        conn
        |> put_flash(:error, "Google sign-in failed.")
        |> redirect(to: ~p"/users/log-in")
    end
  end

  def callback(%{assigns: %{ueberauth_failure: _failure}} = conn, _params) do
    conn
    |> put_flash(:error, "Google sign-in failed.")
    |> redirect(to: ~p"/users/log-in")
  end
end
