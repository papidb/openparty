defmodule OpenParty.RoomsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `OpenParty.Rooms` context.
  """

  import OpenParty.AccountsFixtures

  @doc """
  Generate a room for a given user (or creates a user if none provided).
  """
  def room_fixture(user \\ nil, attrs \\ %{}) do
    user = user || user_fixture()

    attrs =
      Enum.into(attrs, %{
        title: "some title",
        creator_user_id: user.id,
        host_user_id: user.id
      })

    {:ok, room} = OpenParty.Rooms.create_room(attrs)
    room
  end
end
