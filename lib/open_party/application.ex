defmodule OpenParty.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      OpenPartyWeb.Telemetry,
      OpenParty.Repo,
      {DNSCluster, query: Application.get_env(:open_party, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: OpenParty.PubSub},
      OpenPartyWeb.Presence,
      OpenParty.RoomRegistry,
      OpenParty.RoomSupervisor,
      # Start a worker by calling: OpenParty.Worker.start_link(arg)
      # {OpenParty.Worker, arg},
      # Start to serve requests, typically the last entry
      OpenPartyWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: OpenParty.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    OpenPartyWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
