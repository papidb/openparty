defmodule OpenPartyWeb.TokenController do
  use OpenPartyWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias OpenParty.Accounts
  alias OpenPartyWeb.Schemas

  operation(:create,
    summary: "Create API bearer token",
    request_body: {"Token request", "application/json", Schemas.TokenRequest, required: true},
    responses: %{
      200 => {"Token response", "application/json", Schemas.TokenResponse},
      401 => {"Unauthorized", "application/json", Schemas.ErrorResponse}
    }
  )

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
