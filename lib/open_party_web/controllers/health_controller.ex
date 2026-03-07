defmodule OpenPartyWeb.HealthController do
  use OpenPartyWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias OpenPartyWeb.Schemas

  operation(:index,
    summary: "Health check",
    responses: %{
      200 => {"Health response", "application/json", Schemas.HealthResponse}
    }
  )

  def index(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
