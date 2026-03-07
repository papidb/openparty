defmodule OpenPartyWeb.Presence do
  use Phoenix.Presence,
    otp_app: :open_party,
    pubsub_server: OpenParty.PubSub
end
