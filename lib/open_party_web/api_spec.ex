defmodule OpenPartyWeb.ApiSpec do
  @behaviour OpenApiSpex.OpenApi

  alias OpenApiSpex.{Components, Info, OpenApi, Paths, SecurityScheme, Server}

  @impl OpenApiSpex.OpenApi
  def spec do
    %OpenApi{
      info: %Info{
        title: "OpenParty API",
        version: "1.0"
      },
      servers: [%Server{url: "/"}],
      paths: Paths.from_router(OpenPartyWeb.Router),
      components: %Components{
        securitySchemes: %{
          "bearerAuth" => %SecurityScheme{type: "http", scheme: "bearer"}
        }
      }
    }
    |> OpenApiSpex.resolve_schema_modules()
  end
end
