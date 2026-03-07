defmodule OpenPartyWeb.Schemas do
  alias OpenApiSpex.Schema

  defmodule HealthResponse do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "HealthResponse",
      type: :object,
      properties: %{
        status: %Schema{type: :string}
      },
      required: [:status]
    })
  end

  defmodule TokenRequest do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "TokenRequest",
      type: :object,
      properties: %{
        email: %Schema{type: :string, format: :email},
        password: %Schema{type: :string}
      },
      required: [:email, :password]
    })
  end

  defmodule TokenResponse do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "TokenResponse",
      type: :object,
      properties: %{
        token: %Schema{type: :string}
      },
      required: [:token]
    })
  end

  defmodule ErrorResponse do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ErrorResponse",
      type: :object,
      properties: %{
        error: %Schema{type: :string}
      },
      required: [:error]
    })
  end

  defmodule RoomCreateRequest do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "RoomCreateRequest",
      type: :object,
      properties: %{
        title: %Schema{type: :string, nullable: true}
      }
    })
  end

  defmodule RoomResponse do
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "RoomResponse",
      type: :object,
      properties: %{
        room_id: %Schema{type: :string, format: :uuid},
        invite_code: %Schema{type: :string},
        title: %Schema{type: :string, nullable: true},
        status: %Schema{type: :string}
      },
      required: [:room_id, :invite_code, :status]
    })
  end
end
