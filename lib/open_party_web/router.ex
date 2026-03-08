defmodule OpenPartyWeb.Router do
  use OpenPartyWeb, :router

  import OpenPartyWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {OpenPartyWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_scope_for_user
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug OpenApiSpex.Plug.PutApiSpec, module: OpenPartyWeb.ApiSpec
  end

  pipeline :api_auth do
    plug :accepts, ["json"]
    plug :fetch_current_scope_for_api_user
    plug OpenApiSpex.Plug.PutApiSpec, module: OpenPartyWeb.ApiSpec
  end

  scope "/", OpenPartyWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/demo-video", PageController, :demo_video
    get "/auth/:provider", AuthController, :request
    get "/auth/:provider/callback", AuthController, :callback
  end

  scope "/api", OpenPartyWeb do
    pipe_through :api

    get "/health", HealthController, :index
    post "/tokens", TokenController, :create
  end

  scope "/api" do
    pipe_through :api

    get "/openapi", OpenApiSpex.Plug.RenderSpec, []

    forward "/docs", OpenApiSpex.Plug.SwaggerUI,
      path: "/api/openapi",
      default_model_expand_depth: 4
  end

  scope "/api", OpenPartyWeb do
    pipe_through :api_auth

    scope "/rooms" do
      post "/", RoomController, :create
      get "/code/:code", RoomController, :show_by_code
      get "/:id", RoomController, :show
    end
  end

  # Other scopes may use custom stacks.
  # scope "/api", OpenPartyWeb do
  #   pipe_through :api
  # end

  ## Authentication routes

  scope "/", OpenPartyWeb do
    pipe_through [:browser, :require_authenticated_user]

    # EMAIL CONFIRMATION DISABLED: Uncomment the line below to require email confirmation before access.
    # plug :require_confirmed_user

    live_session :require_authenticated_user,
      on_mount: [{OpenPartyWeb.UserAuth, :require_authenticated}] do
      live "/users/settings", UserLive.Settings, :edit
      live "/users/settings/confirm-email/:token", UserLive.Settings, :confirm_email
    end

    post "/users/update-password", UserSessionController, :update_password
  end

  scope "/", OpenPartyWeb do
    pipe_through [:browser]

    live_session :current_user,
      on_mount: [{OpenPartyWeb.UserAuth, :mount_current_scope}] do
      live "/users/register", UserLive.Registration, :new
      live "/users/log-in", UserLive.Login, :new
      live "/users/log-in/:token", UserLive.Confirmation, :new
    end

    post "/users/log-in", UserSessionController, :create
    delete "/users/log-out", UserSessionController, :delete
  end

  if Application.compile_env(:open_party, :dev_routes) do
    scope "/dev" do
      pipe_through :browser

      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
