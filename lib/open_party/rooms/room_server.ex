defmodule OpenParty.Rooms.RoomServer do
  use GenServer

  alias OpenParty.Rooms
  alias OpenParty.Rooms.RoomState

  @type room_id :: String.t()
  @type user_id :: String.t()
  @idle_timeout_ms 15 * 60 * 1_000

  def start_link(room_id) do
    GenServer.start_link(__MODULE__, room_id, name: via(room_id))
  end

  def get_snapshot(room_id), do: GenServer.call(via(room_id), :snapshot)

  def play(room_id, user_id, position_ms, media_id \\ nil),
    do: GenServer.call(via(room_id), {:play, user_id, position_ms, media_id})

  def pause(room_id, user_id, position_ms),
    do: GenServer.call(via(room_id), {:pause, user_id, position_ms})

  def seek(room_id, user_id, position_ms),
    do: GenServer.call(via(room_id), {:seek, user_id, position_ms})

  def sync_check(room_id, user_id, position_ms, revision),
    do: GenServer.call(via(room_id), {:sync_check, user_id, position_ms, revision})

  @impl true
  def init(room_id) do
    room = Rooms.get_room!(room_id)

    state = %RoomState{
      room_id: room.id,
      host_user_id: room.creator_user_id,
      last_updated_at_ms: now_ms()
    }

    Phoenix.PubSub.subscribe(OpenParty.PubSub, "room:" <> room_id)

    state = maybe_start_idle_timer(state)

    {:ok, state}
  end

  @impl true
  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff", payload: payload}, state) do
    state =
      if map_size(payload.joins) > 0 do
        cancel_idle_timer(state)
      else
        state
      end

    state = maybe_start_idle_timer(state)

    {:noreply, state}
  end

  @impl true
  def handle_info(%Phoenix.Socket.Broadcast{}, state) do
    {:noreply, state}
  end

  @impl true
  def handle_info({:idle_timeout, timer_ref}, state) do
    if match?({^timer_ref, _}, state.idle_timer_ref) do
      {:stop, :normal, state}
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    {:reply, snapshot(state), state}
  end

  def handle_call({:play, user_id, position_ms, media_id}, _from, state) do
    with :ok <- authorize_host(user_id, state),
         true <- valid_position_ms?(position_ms) do
      new_state =
        state
        |> Map.put(:playback_state, :playing)
        |> Map.put(:base_position_ms, position_ms)
        |> Map.put(:last_updated_at_ms, now_ms())
        |> Map.put(:media_id, media_id || state.media_id)
        |> bump_revision()

      payload = %{
        playback_state: new_state.playback_state,
        base_position_ms: current_position_ms(new_state),
        revision: new_state.revision,
        changed_by: user_id
      }

      broadcast_update(new_state.room_id, payload)

      {:reply, {:ok, snapshot(new_state)}, new_state}
    else
      {:error, :forbidden} -> {:reply, {:error, :forbidden}, state}
      false -> {:reply, {:error, :invalid_position}, state}
    end
  end

  def handle_call({:pause, user_id, position_ms}, _from, state) do
    with :ok <- authorize_host(user_id, state),
         true <- valid_position_ms?(position_ms) do
      new_state =
        state
        |> Map.put(:playback_state, :paused)
        |> Map.put(:base_position_ms, position_ms)
        |> Map.put(:last_updated_at_ms, now_ms())
        |> bump_revision()

      payload = %{
        playback_state: new_state.playback_state,
        base_position_ms: current_position_ms(new_state),
        revision: new_state.revision,
        changed_by: user_id
      }

      broadcast_update(new_state.room_id, payload)

      {:reply, {:ok, snapshot(new_state)}, new_state}
    else
      {:error, :forbidden} -> {:reply, {:error, :forbidden}, state}
      false -> {:reply, {:error, :invalid_position}, state}
    end
  end

  def handle_call({:seek, user_id, position_ms}, _from, state) do
    with :ok <- authorize_host(user_id, state),
         true <- valid_position_ms?(position_ms) do
      new_state =
        state
        |> Map.put(:base_position_ms, position_ms)
        |> Map.put(:last_updated_at_ms, now_ms())
        |> bump_revision()

      payload = %{
        playback_state: new_state.playback_state,
        base_position_ms: current_position_ms(new_state),
        revision: new_state.revision,
        changed_by: user_id
      }

      broadcast_update(new_state.room_id, payload)

      {:reply, {:ok, snapshot(new_state)}, new_state}
    else
      {:error, :forbidden} -> {:reply, {:error, :forbidden}, state}
      false -> {:reply, {:error, :invalid_position}, state}
    end
  end

  def handle_call({:sync_check, _user_id, client_position_ms, client_revision}, _from, state) do
    cond do
      not valid_position_ms?(client_position_ms) ->
        {:reply, {:error, :invalid_position}, state}

      client_revision < state.revision ->
        {:reply, {:ok, {:corrective_snapshot, snapshot(state)}}, state}

      true ->
        authoritative_pos = current_position_ms(state)
        drift = abs(authoritative_pos - client_position_ms)

        cond do
          drift <= 250 -> {:reply, {:ok, :in_sync}, state}
          drift <= 1200 -> {:reply, {:ok, {:minor_drift, drift}}, state}
          true -> {:reply, {:ok, {:corrective_snapshot, snapshot(state)}}, state}
        end
    end
  end

  defp authorize_host(user_id, state) do
    if user_id == state.host_user_id, do: :ok, else: {:error, :forbidden}
  end

  defp current_position_ms(state) do
    case state.playback_state do
      :paused ->
        state.base_position_ms

      :playing ->
        round(
          state.base_position_ms + (now_ms() - state.last_updated_at_ms) * state.playback_rate
        )
    end
  end

  defp snapshot(state) do
    %{
      room_id: state.room_id,
      host_user_id: state.host_user_id,
      playback_state: state.playback_state,
      base_position_ms: current_position_ms(state),
      playback_rate: state.playback_rate,
      revision: state.revision,
      media_id: state.media_id
    }
  end

  defp bump_revision(state) do
    %{state | revision: state.revision + 1}
  end

  defp broadcast_update(room_id, payload) do
    OpenPartyWeb.Endpoint.broadcast!("room:" <> to_string(room_id), "playback_updated", payload)
  end

  defp maybe_start_idle_timer(state) do
    presences = OpenPartyWeb.Presence.list("room:" <> state.room_id)

    if map_size(presences) == 0 and is_nil(state.idle_timer_ref) do
      timer_ref = make_ref()
      process_timer_ref = Process.send_after(self(), {:idle_timeout, timer_ref}, @idle_timeout_ms)
      %{state | idle_timer_ref: {timer_ref, process_timer_ref}}
    else
      state
    end
  end

  defp cancel_idle_timer(state) do
    if state.idle_timer_ref do
      {_timer_ref, process_timer_ref} = state.idle_timer_ref
      Process.cancel_timer(process_timer_ref)
      %{state | idle_timer_ref: nil}
    else
      state
    end
  end

  defp now_ms, do: System.system_time(:millisecond)

  defp valid_position_ms?(position_ms), do: is_integer(position_ms) and position_ms >= 0

  defp via(room_id), do: {:via, Registry, {OpenParty.RoomRegistry, room_id}}
end
