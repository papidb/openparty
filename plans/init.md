# Initial Teleparty open-source alternative

Below is a clean implementation plan and technical spec you can hand to your AI CLI.

It is written for this stack:

* **Backend:** Elixir + Phoenix
* **Database:** Postgres
* **Hosting:** Railway
* **Client:** browser extension first
* **Realtime transport:** Phoenix Channels
* **Goal:** Teleparty-like sync for websites without overcomplicating the first version

---

# Project Goal

Build a lightweight watch-party / shared-playback backend that allows multiple users to join a room and keep playback synchronized.

This system is **not** responsible for streaming video itself.

Each user still watches content locally on the target website. Our system only synchronizes:

* play
* pause
* seek
* current playback position
* host / room controller
* room membership / presence

We are optimizing for:

* fast MVP
* low infrastructure complexity
* simple deployment
* easy future scaling

We are **not** building:

* a video CDN
* a shared cloud browser
* a full co-browsing product
* a microservice architecture
* Kafka-based event pipelines
* complex distributed sharding on day one

---

# Product Scope for MVP

## Core features

1. Users can create a room
2. Users can join a room
3. A room has a current playback state
4. One user is the host/controller
5. Host actions are broadcast to everyone else
6. Users can reconnect and get the latest room state
7. Users in a room can see who is connected
8. The extension/client can periodically resync if playback drifts

## Out of scope for MVP

1. Chat
2. Reactions
3. Multi-host / democratic control
4. Video calling
5. Recording session history
6. Durable event replay
7. Complex moderation
8. Cross-provider custom adapters beyond a basic generic HTML5 approach

---

# High-Level Architecture

## Simple architecture

```text
Browser Extension / Web Client
        |
        | WebSocket
        v
   Phoenix Channel
        |
        v
  Room Process (GenServer)
        |
        +--> Phoenix Presence
        |
        +--> Phoenix PubSub
        |
        +--> Postgres for persistent room metadata
```

## Why this architecture

Phoenix and Elixir already solve most of what we need:

* long-lived WebSocket connections
* lightweight concurrent processes
* pub/sub
* presence tracking
* fault isolation
* simple room-based state ownership

The clean mental model is:

* **one room = one process**
* that room process holds the authoritative playback state in memory
* connected clients join a Phoenix channel for that room
* playback commands go to the room process
* the room process validates and updates state
* the room process broadcasts the new authoritative state

---

# Architecture Decisions

## 1. Keep live playback state in memory

The authoritative playback state for a room should live in the room GenServer, not in Postgres.

Reason:

* this state changes frequently
* it is ephemeral
* it needs low latency
* writing every play / pause / seek to Postgres is unnecessary

## 2. Use Postgres only for persistent metadata

Use Postgres for things like:

* users
* rooms
* room creator
* room settings
* invite codes / room tokens if needed
* created_at / updated_at
* analytics later if needed

## 3. Host-only control first

For MVP, only the host should be able to control playback.

Reason:

* simpler protocol
* fewer conflict cases
* easier UX
* easier reasoning about authority

## 4. Use revisions to avoid stale updates

Every authoritative room update should increase a `revision` number.

Clients only apply updates with a higher revision than what they already have.

This protects against:

* duplicate messages
* out-of-order delivery
* reconnect weirdness

## 5. Reconnect using snapshots, not event replay

When a client reconnects, it should fetch the latest authoritative room snapshot and resync from that.

We do **not** need durable event replay for MVP.

---

# Core Backend Concepts

## 1. Room Channel

Each room has a Phoenix channel topic like:

```text
room:<room_id>
```

Example:

```text
room:abc123
```

Clients join this channel after authenticating.

## 2. Room GenServer

Each active room is represented by a GenServer.

Responsibilities:

* hold authoritative playback state
* validate incoming commands
* enforce host-only control
* update revision
* compute snapshots
* broadcast updates

## 3. Presence

Phoenix Presence tracks who is currently connected in the room.

Responsibilities:

* joined users
* disconnected users
* optional metadata like username or avatar later

## 4. Registry / Dynamic Supervisor

We need a way to start and find room processes.

Use:

* `DynamicSupervisor` to spawn room servers
* `Registry` to look them up by room ID

This gives us:

* one process per active room
* no need to manually track PIDs

---

# Room State Model

The room process should store something like this:

```elixir
defmodule MyApp.Rooms.RoomState do
  @type playback_state :: :playing | :paused

  defstruct [
    :room_id,
    :host_user_id,
    :media_id,
    :playback_state,
    :base_position_ms,
    :last_updated_at_ms,
    :playback_rate,
    :revision,
    :members
  ]
end
```

## Explanation of fields

* `room_id`: unique room identifier
* `host_user_id`: user currently allowed to control playback
* `media_id`: optional identifier for current media/session
* `playback_state`: `:playing` or `:paused`
* `base_position_ms`: playback position at the last authoritative update
* `last_updated_at_ms`: server timestamp when the last update happened
* `playback_rate`: usually `1.0`
* `revision`: incremented every update
* `members`: optional in-memory set / map of connected members if useful, though Presence already tracks this

---

# Playback Sync Model

## Important idea

Do not only store `current_position_ms`.

Instead store:

* current play/pause state
* base position at last update
* last server update time
* playback rate
* revision

This allows the server and clients to compute the current target position.

## Formula

If the room is playing, the current authoritative position is:

```text
current_position =
  base_position_ms + (now_ms - last_updated_at_ms) * playback_rate
```

If paused, the current position is just:

```text
current_position = base_position_ms
```

This is the core of the sync system.

---

# Phoenix Backend Structure

Suggested structure:

```text
lib/
  my_app/
    application.ex
    repo.ex

    rooms/
      room_state.ex
      room_server.ex
      room_supervisor.ex
      room_registry.ex
      room_manager.ex
      room_store.ex

    web/
      channels/
        user_socket.ex
        room_channel.ex

      presence.ex

    accounts/
      user.ex

    rooms_schema/
      room.ex
```

## Module responsibilities

### `RoomState`

Defines the in-memory room state struct.

### `RoomServer`

The GenServer for a single room. Holds live authoritative state.

### `RoomSupervisor`

DynamicSupervisor for room processes.

### `RoomRegistry`

Registry for finding room server processes by room ID.

### `RoomManager`

Public API for room operations like:

* start_or_get_room/1
* join_room/2
* play/3
* pause/2
* seek/3
* snapshot/1

### `RoomStore`

Handles Postgres interaction for room metadata.

### `RoomChannel`

Phoenix Channel for websocket communication.

### `Presence`

Tracks connected users per room.

---

# Data Flow

## Room join flow

1. Client opens websocket connection
2. Client joins topic `room:<room_id>`
3. Backend verifies room exists or creates it if appropriate
4. Backend starts room process if not already running
5. Client is tracked in Presence
6. Backend sends room snapshot to joining client
7. Client aligns local player to authoritative room state

## Play command flow

1. Host presses play in the website player
2. Extension detects local `play` event
3. Extension sends `"play"` message to Phoenix channel
4. Channel forwards command to room server
5. Room server validates user is host
6. Room server updates:

   * playback_state = `:playing`
   * base_position_ms = provided/current position
   * last_updated_at_ms = current server time
   * revision += 1
7. Room server broadcasts authoritative playback update
8. Clients receive update and apply it if revision is newer

## Pause command flow

Same as play, except:

* playback_state = `:paused`
* base_position_ms = current paused position
* last_updated_at_ms = server time
* revision += 1

## Seek command flow

1. Host drags or seeks to a new position
2. Extension sends `"seek"` with target position
3. Room server validates authority
4. Room server updates base position and timestamp
5. Room server broadcasts new authoritative state
6. Clients seek their local player to match

## Reconnect flow

1. Client reconnects to channel
2. Backend sends latest snapshot
3. Client computes target position
4. Client resyncs local player
5. Client resumes normal sync behavior

---

# Channel Protocol

We want a very small and explicit protocol.

## Client -> Server events

### `join_room`

Usually handled implicitly by Phoenix join. No custom event required beyond channel join.

### `play`

Payload:

```json
{
  "position_ms": 120000,
  "media_id": "optional-media-id"
}
```

### `pause`

Payload:

```json
{
  "position_ms": 123500
}
```

### `seek`

Payload:

```json
{
  "position_ms": 845000
}
```

### `sync_check`

Payload:

```json
{
  "position_ms": 121450,
  "last_applied_revision": 22
}
```

Use this if the client wants the server to confirm whether it is drifting.

### `request_snapshot`

Payload:

```json
{}
```

Used on reconnect or when the extension thinks it got out of sync.

---

## Server -> Client events

### `snapshot`

Payload example:

```json
{
  "room_id": "abc123",
  "host_user_id": "user_1",
  "media_id": "optional-media-id",
  "playback_state": "playing",
  "base_position_ms": 120000,
  "last_updated_at_ms": 1772910200100,
  "playback_rate": 1.0,
  "revision": 22
}
```

### `playback_updated`

Payload example:

```json
{
  "room_id": "abc123",
  "host_user_id": "user_1",
  "playback_state": "paused",
  "base_position_ms": 123500,
  "last_updated_at_ms": 1772910201100,
  "playback_rate": 1.0,
  "revision": 23,
  "changed_by": "user_1"
}
```

### `presence_state`

Handled by Phoenix Presence.

### `presence_diff`

Handled by Phoenix Presence.

### `error`

Payload example:

```json
{
  "code": "forbidden",
  "message": "Only the host can control playback"
}
```

---

# Room Server Responsibilities

`RoomServer` must be the single source of truth for room playback state.

## It should expose functions like

* `get_snapshot(room_id)`
* `play(room_id, user_id, position_ms, media_id \\ nil)`
* `pause(room_id, user_id, position_ms)`
* `seek(room_id, user_id, position_ms)`
* `sync_check(room_id, user_id, position_ms, revision)`

## Validation rules

### For every control command

* room must exist
* room process must exist or be created
* user must be host for MVP
* position must be a non-negative integer
* optional media validation can be added later

### For sync_check

* compare client position with authoritative computed position
* if drift is above threshold, return / broadcast corrective snapshot
* otherwise no action needed

---

# Drift Correction Strategy

We do not want constant aggressive seeks.

Use this simple policy:

## Drift thresholds

### Less than 250 ms

* ignore

### Between 250 ms and 1200 ms

* client may gently correct locally
* or simply wait for next update if that is easier for MVP

### Greater than 1200 ms

* force hard resync using authoritative position

## MVP recommendation

Keep it simple:

* client detects local drift occasionally
* if drift is above threshold, client requests snapshot
* client hard seeks to authoritative position

This is enough for v1.

Do not implement subtle playback rate correction yet unless it becomes necessary.

---

# Extension / Client Responsibilities

The browser extension will likely be harder than the backend, so keep its responsibilities explicit.

## The extension should

1. detect the media element or page player
2. connect to Phoenix websocket
3. join room channel
4. listen for local playback events:

   * play
   * pause
   * seeked
5. send those events if current user is host
6. listen for server playback updates
7. apply updates to local player
8. periodically compare local state to authoritative state
9. request snapshot if out of sync

## Important note

The generic version should focus on HTML5 video first.

Example assumption:

* website exposes a usable `<video>` element
* we can read `currentTime`
* we can call `play()`, `pause()`, and set `currentTime`

Do not try to support highly customized providers immediately.

---

# Presence

Use Phoenix Presence for room membership.

## Use it for

* list of connected users
* showing join/leave state
* optional host badge

## Do not store presence in Postgres

Presence is ephemeral and belongs in the realtime layer.

---

# Postgres Schema

We only need a very small schema for MVP.

## `rooms`

```sql
create table rooms (
  id uuid primary key,
  creator_user_id uuid not null,
  host_user_id uuid not null,
  title text,
  status text not null default 'active',
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## `room_members` optional

This is optional for MVP.

Use it if you want persistent membership history.

```sql
create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'viewer',
  inserted_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
```

## `users`

Use whatever user table already exists. If auth is out of scope, use a minimal placeholder.

---

# Minimal API Surface

This system can be mostly websocket-driven, but you may still want a few HTTP endpoints.

## Recommended HTTP endpoints

### `POST /api/rooms`

Creates a room.

Response:

```json
{
  "room_id": "abc123",
  "host_user_id": "user_1"
}
```

### `GET /api/rooms/:id`

Returns room metadata only, not live playback state.

Response:

```json
{
  "id": "abc123",
  "host_user_id": "user_1",
  "status": "active"
}
```

### Live playback state

Should come from the channel, not HTTP.

---

# Suggested Phoenix Implementation Details

## Room registry

Use Elixir `Registry`:

* name rooms by room ID
* look up room process quickly

## Room process lifecycle

When a room is first joined:

1. look up room process in Registry
2. if missing, start under DynamicSupervisor
3. initialize state from DB room metadata if needed
4. room process stays alive while active
5. optionally terminate after inactivity timeout

## Inactivity timeout

Recommended:

* if no one is present in the room for X minutes, stop the room process

Example:

* 10 minutes idle timeout

This keeps memory use clean.

---

# Railway Deployment Notes

Railway is okay for MVP, but keep these realities in mind:

## 1. In-memory room state is node-local

If you run multiple Phoenix instances, the room process lives on one instance only.

For early stage, that is okay if traffic is low and deployment is simple.

## 2. Best MVP deployment shape

Start with:

* one Phoenix app instance
* one Postgres instance

This is the least confusing setup.

## 3. PubSub adapter

If you stay on one instance initially, default Phoenix PubSub is enough.

If you go multi-node later, evaluate Redis-backed pub/sub or Phoenix clustering approach.

## 4. Sticky sessions

WebSockets need long-lived connections. Railway can support this, but test it carefully.

For the MVP, assume a single app instance first.

---

# What Not To Build Yet

Do not add these until the MVP works:

1. Redis
2. Kafka
3. NATS
4. background workers for sync
5. durable playback event logs
6. multi-region architecture
7. room sharding
8. complicated rate control
9. democratic playback control
10. full adapter framework for every streaming site

The main goal is a working room process + channel sync loop.

---

# Build Order

This is the implementation sequence I want the CLI to follow.

## Phase 1: Foundation

1. create Phoenix project with Postgres
2. configure Room schema and Room context
3. add minimal room creation HTTP endpoint
4. configure Phoenix Channels
5. configure Presence
6. add Registry and DynamicSupervisor for rooms

## Phase 2: Live room process

1. implement `RoomState`
2. implement `RoomServer`
3. implement `RoomManager`
4. support room startup and lookup by room ID
5. implement snapshot generation

## Phase 3: Channel integration

1. implement `RoomChannel`
2. support joining `room:<room_id>`
3. send initial snapshot on join
4. track presence on join
5. remove presence on disconnect

## Phase 4: Playback protocol

1. implement `play`
2. implement `pause`
3. implement `seek`
4. validate host-only control
5. increment revision
6. broadcast `playback_updated`

## Phase 5: Resync support

1. implement `request_snapshot`
2. implement `sync_check`
3. return corrective snapshot when drift is too large

## Phase 6: Cleanup and stability

1. add inactivity timeout for idle room processes
2. add basic tests
3. add logging
4. add simple authorization hook
5. add environment config for Railway

---

# Required Tests

The CLI should include tests. We do not want this built without coverage.

## Unit tests for RoomServer

### Should cover

* initializes room state correctly
* host can play
* host can pause
* host can seek
* non-host cannot control playback
* revision increments on every valid update
* snapshot computes current position correctly while playing
* paused snapshot returns base position unchanged

## Channel tests

### Should cover

* client can join valid room channel
* join returns snapshot
* play event updates room and broadcasts
* pause event updates room and broadcasts
* seek event updates room and broadcasts
* non-host command returns error
* presence is tracked on join

## HTTP tests

### Should cover

* room creation endpoint works
* room fetch endpoint works

---

# Example Pseudocode

## RoomServer

```elixir
defmodule MyApp.Rooms.RoomServer do
  use GenServer

  def start_link(room_id) do
    GenServer.start_link(__MODULE__, room_id, name: via(room_id))
  end

  def init(room_id) do
    state = %RoomState{
      room_id: room_id,
      host_user_id: nil,
      media_id: nil,
      playback_state: :paused,
      base_position_ms: 0,
      last_updated_at_ms: now_ms(),
      playback_rate: 1.0,
      revision: 0
    }

    {:ok, state}
  end

  def handle_call({:snapshot}, _from, state) do
    {:reply, snapshot(state), state}
  end

  def handle_call({:play, user_id, position_ms, media_id}, _from, state) do
    with :ok <- authorize_host(state, user_id) do
      new_state =
        state
        |> Map.put(:media_id, media_id || state.media_id)
        |> Map.put(:playback_state, :playing)
        |> Map.put(:base_position_ms, position_ms)
        |> Map.put(:last_updated_at_ms, now_ms())
        |> bump_revision()

      broadcast_update(new_state, user_id)
      {:reply, {:ok, snapshot(new_state)}, new_state}
    else
      error -> {:reply, error, state}
    end
  end
end
```

## Snapshot function

```elixir
defp snapshot(state) do
  %{
    room_id: state.room_id,
    host_user_id: state.host_user_id,
    media_id: state.media_id,
    playback_state: state.playback_state,
    base_position_ms: current_position_ms(state),
    last_updated_at_ms: now_ms(),
    playback_rate: state.playback_rate,
    revision: state.revision
  }
end
```

## Current position helper

```elixir
defp current_position_ms(%{playback_state: :paused, base_position_ms: pos}), do: pos

defp current_position_ms(state) do
  delta = now_ms() - state.last_updated_at_ms
  trunc(state.base_position_ms + delta * state.playback_rate)
end
```

---

# Acceptance Criteria for MVP

The MVP is done when all of the following are true:

1. A room can be created
2. A user can join a room over Phoenix Channels
3. The first joining host can control playback
4. Other users receive authoritative playback updates in real time
5. Reconnect returns a correct snapshot
6. Out-of-order or duplicate updates do not break state because revisions are used
7. Presence shows who is in the room
8. The system works on Railway with Postgres
9. Tests cover room logic and channel flows

---

# Instructions to the AI CLI

Use these as direct implementation instructions.

## Backend instructions

Build a Phoenix application for a Teleparty-like playback synchronization backend.

Requirements:

* use Elixir + Phoenix
* use Postgres only for persistent room metadata
* use Phoenix Channels for realtime communication
* use Phoenix Presence for connected room users
* use one GenServer per active room as the authoritative live state holder
* use Registry + DynamicSupervisor to manage room processes
* implement room topic format as `room:<room_id>`
* implement live commands:

  * `play`
  * `pause`
  * `seek`
  * `request_snapshot`
  * `sync_check`
* enforce host-only playback control for MVP
* maintain room state in memory with:

  * room_id
  * host_user_id
  * media_id
  * playback_state
  * base_position_ms
  * last_updated_at_ms
  * playback_rate
  * revision
* increment revision for every valid authoritative update
* broadcast `playback_updated` events to the room channel
* send `snapshot` on channel join
* implement helper logic to compute current authoritative playback position from base position and last updated timestamp
* add inactivity timeout for idle room processes
* include tests for room server, channels, and minimal HTTP room endpoints
* keep the implementation simple and production-aware, but do not add Redis, Kafka, multi-node clustering, or chat yet

## Engineering constraints

* optimize for clarity over cleverness
* keep modules small and explicit
* make public APIs obvious
* prefer deterministic behavior
* do not over-engineer for scale yet
* structure code so Redis/pubsub clustering can be added later without rewriting core room logic

---

# Final recommendation

This is the right first build:

* **Phoenix**
* **Elixir**
* **Postgres**
* **Railway**
* **room GenServers**
* **Phoenix Channels**
* **Presence**
* **single-node deployment first**

That gives you a real working MVP without dragging in unnecessary infrastructure.

If you want, I can turn this into a second document that is even more CLI-friendly, with:

* exact Phoenix file names
* exact module skeletons
* migrations
* channel code
* GenServer code
* test skeletons
