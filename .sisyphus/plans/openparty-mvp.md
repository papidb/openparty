# OpenParty MVP — Teleparty Open-Source Alternative

## TL;DR

> **Quick Summary**: Build a Phoenix 1.8.5 backend for synchronized video playback across multiple users. Rooms use one GenServer per active session as the authoritative state holder, communicating via Phoenix Channels. Proper auth with email/password + Google/GitHub OAuth via `mix phx.gen.auth` + `ueberauth`.
> 
> **Deliverables**:
> - Phoenix application with full auth system (register, login, OAuth, email confirmation disabled by default — one-line flag to enable)
> - Room management (create, join via URL or invite code, presence tracking)
> - Real-time playback sync protocol (play/pause/seek/snapshot/sync_check)
> - GenServer per room with revision-based state, drift detection, inactivity timeout
> - Railway deployment config (Dockerfile, runtime.exs)
> - Test suite covering room logic, channels, and HTTP endpoints
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: T1 (scaffold) → T3 (auth) → T6 (room schema) → T8 (GenServer) → T11 (channel) → T14 (playback) → T18 (tests) → Final Verification

---

## Context

### Original Request
Build an open-source alternative to Teleparty — a watch party synchronization backend that keeps multiple users' video playback in sync. The system synchronizes play/pause/seek/position across connected clients. It does NOT stream video itself; each user watches content locally.

### Interview Summary
**Key Discussions**:
- **Scope**: Backend only. Browser extension will be a separate plan.
- **Auth**: Changed from anonymous to proper auth with `mix phx.gen.auth` (email/password + Google/GitHub OAuth via `ueberauth`). LiveView-based auth pages.
- **Room sharing**: Both shareable URL (`/room/:id`) AND 6-character invite code.
- **Room ownership**: Creator = permanent owner. Auto-reclaim host control on reconnect.
- **Email delivery**: Configure real email service via Swoosh (not just console logging).
- **Tests**: After implementation (not TDD). Agent-executed QA for verification.

**Research Findings**:
- Phoenix 1.8.5 `mix phx.gen.auth` includes: magic links, sudo mode, API bearer tokens, scopes, session tracking
- `pow` library is INCOMPATIBLE with Phoenix 1.8.5 (dependency ceiling `< 1.8.0`)
- `ueberauth` is the standard OAuth library for Phoenix/Elixir ecosystems
- GenServer + DynamicSupervisor + Registry is the canonical one-process-per-entity pattern

### Metis Review
**Identified Gaps** (addressed):
- Project scaffolding must use temp directory then move into existing repo (preserves `.git/`)
- Postgres must be started via Docker (`psql` not available locally)
- `invite_code` column with unique index missing from original spec schema — added
- `GET /api/rooms/code/:invite_code` endpoint missing from original spec — added
- `GET /api/health` health check endpoint needed for Railway — added
- `corsica` dependency needed for CORS (browser extension will need it) — added
- Invite code collision handling (retry on unique violation) — added
- Channel join vs room process race condition handling — added
- Identity persistence: use authenticated user_id (not socket-assigned), so host can reconnect and reclaim
- Email confirmation **disabled by default**: `phx.gen.auth` generates confirmation flow — keep the code, disable the guard. Re-enable with a single config flag or by removing one plug from the router pipeline.

---

## Work Objectives

### Core Objective
Build a production-aware Phoenix backend that synchronizes video playback across multiple authenticated users in real-time, deployable to Railway.

### Concrete Deliverables
- Phoenix 1.8.5 application (`open_party` / `OpenParty`)
- Full auth system: email/password registration, Google OAuth, GitHub OAuth, LiveView auth pages — email confirmation infrastructure generated but **disabled by default** (one-line re-enable)
- Room CRUD: create rooms, fetch by ID, fetch by invite code
- Real-time playback sync: Phoenix Channels with play/pause/seek/sync_check/snapshot protocol
- GenServer per room: authoritative state, revision tracking, drift detection, inactivity timeout
- Presence tracking: who's in each room
- Railway deployment: multi-stage Dockerfile, runtime.exs, health endpoint
- Test suite: room server, channels, HTTP endpoints

### Definition of Done
- [ ] `mix test` passes with 0 failures
- [ ] `mix compile --warnings-as-errors` succeeds
- [ ] Room can be created via `POST /api/rooms` with auth token
- [ ] Room can be joined via Phoenix Channel with authenticated socket
- [ ] Host can play/pause/seek and all connected clients receive `playback_updated`
- [ ] Non-host playback commands return `{code: "forbidden"}` error
- [ ] Reconnecting client receives correct snapshot with computed position
- [ ] Presence shows connected users in room
- [ ] OAuth login works for Google and GitHub
- [ ] Email registration works — users can log in immediately without confirming email (confirmation disabled by default)
- [ ] Health endpoint returns `{"status": "ok"}`
- [ ] Docker image builds successfully

### Must Have
- Authenticated users only (no anonymous access)
- Host-only playback control
- Revision-based state ordering (stale updates rejected via `sync_check`; play/pause/seek commands do NOT require client revision — they are host-only and authoritative by design)
- Snapshot-based reconnect (no event replay)
- Invite code uniqueness (DB-level constraint)
- CORS headers for cross-origin requests
- Inactivity timeout for idle room processes

### Must NOT Have (Guardrails)
- No abstraction layers (no CommandDispatcher, SyncStrategy, PlaybackEngine patterns)
- No host transfer or auto-promotion on disconnect
- No chat, reactions, or video calling
- No Redis, Kafka, NATS, or multi-node clustering
- No durable event replay or event sourcing
- No site-specific video adapters
- No CI/CD pipeline or GitHub Actions
- No over-engineered rate limiting
- No democratic playback control
- No room sharding
- No excessive JSDoc/comments on obvious code
- No premature abstraction (utils, helpers, strategies)
- No more than 5 HTTP endpoints (POST rooms, GET rooms/:id, GET rooms/code/:code, GET health, POST tokens)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: Will be created (Phoenix generates test infrastructure)
- **Automated tests**: YES — tests after implementation
- **Framework**: ExUnit (built into Elixir) with Phoenix test helpers
- **Test commands**: `mix test`, `mix test test/open_party/rooms/`, `mix test test/open_party_web/`

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **HTTP endpoints**: Use Bash (`curl`) — Send requests, assert status + response JSON
- **Channel protocol**: Use `mix test` with `Phoenix.ChannelTest` — Push events, assert broadcasts
- **GenServer logic**: Use `mix test` with ExUnit — Call functions, assert state changes
- **Auth flows**: Use `mix test` with ConnTest — Register, login, verify tokens
- **Deployment**: Use Bash (`docker build`) — Build image, verify success

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — scaffold + infrastructure):
├── Task 1: Phoenix project scaffolding + Docker Postgres [quick]
├── Task 2: CORS + health endpoint + base config [quick]
└── Task 3: Auth system (phx.gen.auth + deps) [unspecified-high]

Wave 2 (Auth Expansion + Room Foundation — after Wave 1):
├── Task 4: Google OAuth setup [quick]
├── Task 5: GitHub OAuth setup [quick]
├── Task 6: Room schema + context + migrations [unspecified-high]
├── Task 7: Swoosh email configuration [quick]
└── Task 8: RoomState + RoomServer GenServer [deep]

Wave 3 (Room Infrastructure — after Wave 2):
├── Task 9: RoomSupervisor + RoomRegistry + RoomManager [unspecified-high]
├── Task 10: Room HTTP API endpoints [quick]
├── Task 11: Socket auth + RoomChannel join + Presence [deep]
└── Task 12: API auth (bearer tokens) [quick]

Wave 4 (Playback Protocol — after Wave 3):
├── Task 13: Playback commands (play/pause/seek) [deep]
├── Task 14: Snapshot + sync_check + drift correction [deep]
└── Task 15: Inactivity timeout + room cleanup [unspecified-high]

Wave 5 (Tests + Deployment — after Wave 4):
├── Task 16: RoomServer unit tests [unspecified-high]
├── Task 17: RoomChannel tests [unspecified-high]
├── Task 18: HTTP endpoint + auth tests [unspecified-high]
├── Task 19: Railway deployment config (Dockerfile + runtime.exs) [quick]
└── Task 20: Invite code generation + lookup endpoint [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Full QA run (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: T1 → T3 → T6 → T8 → T9 → T11 → T13 → T14 → T16 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2,3,4,5,6,7,8 | 1 |
| 2 | 1 | 10,19 | 1 |
| 3 | 1 | 4,5,6,7,8,11,12 | 1 |
| 4 | 3 | 18 | 2 |
| 5 | 3 | 18 | 2 |
| 6 | 1,3 | 8,9,10,11 | 2 |
| 7 | 3 | 18 | 2 |
| 8 | 6 | 9,13,14,15,16 | 2 |
| 9 | 8 | 11,13,14,15 | 3 |
| 10 | 2,6,12 | 18 | 3 |
| 11 | 3,6,9 | 13,14,17 | 3 |
| 12 | 3 | 10 | 3 |
| 13 | 9,11 | 14,16,17 | 4 |
| 14 | 9,11,13 | 16,17 | 4 |
| 15 | 8,9 | 16 | 4 |
| 16 | 8,13,14,15 | F1-F4 | 5 |
| 17 | 11,13,14 | F1-F4 | 5 |
| 18 | 3,4,5,7,10 | F1-F4 | 5 |
| 19 | 2 | F1-F4 | 5 |
| 20 | 6 | F1-F4 | 5 |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `quick`, T2 → `quick`, T3 → `unspecified-high`
- **Wave 2**: **5 tasks** — T4 → `quick`, T5 → `quick`, T6 → `unspecified-high`, T7 → `quick`, T8 → `deep`
- **Wave 3**: **4 tasks** — T9 → `unspecified-high`, T10 → `quick`, T11 → `deep`, T12 → `quick`
- **Wave 4**: **3 tasks** — T13 → `deep`, T14 → `deep`, T15 → `unspecified-high`
- **Wave 5**: **5 tasks** — T16-T18 → `unspecified-high`, T19 → `quick`, T20 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

<!-- WAVE 1 -->

- [x] T1. **Phoenix project scaffolding + Docker Postgres** — `quick`
  Scaffold Phoenix 1.8.5 into `/tmp/open_party` (with LiveView for auth pages, binary-id, with Ecto, no dashboard/gettext), then move generated files into the repo root at `/Users/user/playground/openparty`, preserving the existing `.git/` directory. Start a Postgres 17 container via Docker. Configure `config/dev.exs` to connect to it. Run `mix deps.get && mix ecto.create` and verify success.
  **What to do**:
  1. Run: `mix phx.new /tmp/open_party --app open_party --module OpenParty --no-mailer --no-dashboard --binary-id --no-gettext` (say yes to install deps, yes to LiveView)
  2. Copy all generated files from `/tmp/open_party/` into `/Users/user/playground/openparty/` except `.git/`
  3. Start Postgres: `docker run -d --name openparty-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 5432:5432 postgres:17-alpine`
  4. Update `config/dev.exs` database config: hostname `localhost`, username `postgres`, password `postgres`, database `open_party_dev`
  5. Update `config/test.exs` database config similarly (database `open_party_test`)
  6. Run `mix deps.get && mix ecto.create`
  7. Run `mix compile`
  **Must NOT do**: Do not delete `.git/`. Do not start the Phoenix server. Do not add any custom code — only scaffolding.
  **Verify**: `mix compile` exits 0. `mix ecto.create` succeeds.
  **Commit**: `feat: scaffold Phoenix 1.8.5 project with Postgres`

- [x] T2. **CORS + health endpoint + base config** — `quick`
  Add `corsica` dependency for CORS and a health check endpoint. This is needed for the browser extension and Railway health checks.
  **What to do**:
  1. Add `{:corsica, "~> 2.0"}` to `mix.exs` deps, run `mix deps.get`
  2. Add Corsica plug to `lib/open_party_web/endpoint.ex` before the router — allow all origins for MVP: `plug Corsica, origins: "*", allow_headers: :all`
  3. Add a health controller at `lib/open_party_web/controllers/health_controller.ex` that responds to GET with `{"status": "ok"}`
  4. Add route in `lib/open_party_web/router.ex`: `get "/api/health", HealthController, :index`
  **Must NOT do**: Do not add authentication to the health endpoint. Do not use LiveView for this.
  **Verify**: `mix compile` exits 0. `curl -s http://localhost:4000/api/health | jq '.status'` returns `"ok"` after `mix phx.server`.
  **Save evidence**: `.sisyphus/evidence/task-2-health.txt`

- [x] T3. **Auth system (phx.gen.auth + confirmation disabled)** — `unspecified-high`
  Generate the full authentication system with `mix phx.gen.auth` using LiveView (user's preference). Then disable email confirmation by default (keep all generated code, just comment out the confirmation guard plug) with a clear `# CONFIRMATION_DISABLED` comment explaining how to re-enable.
  **What to do**:
  1. Run: `mix phx.gen.auth Accounts User users` (accept LiveView default — answer Y at the prompt)
  2. Run `mix deps.get && mix ecto.migrate`
  3. In `lib/open_party_web/router.ex`, find the `require_confirmed_user` plug or `redirect_if_user_is_authenticated` pipeline — comment out `plug :require_confirmed_user` with note:
     ```elixir
     # EMAIL CONFIRMATION DISABLED: Uncomment to require email confirmation before access.
     # plug :require_confirmed_user
     ```
  4. In `lib/open_party_web/user_auth.ex`, verify `require_confirmed_user/2` function exists but is not called from router pipeline
  5. Add `display_name` field to the users schema and migration: `add :display_name, :string, null: false, default: ""`
  6. Run `mix ecto.migrate`
  7. Run `mix test` — all generated tests must pass
  **Must NOT do**: Do not delete any generated confirmation code. Do not change the UserToken schema. Do not add OAuth here (that's T4/T5). Do not add `hashed_password null: true` — keep standard password flow.
  **Verify**: `mix test` passes. Register a user via curl or conn test, verify they can log in immediately without confirming email.
  **Commit**: `feat: add user authentication with email confirmation disabled by default`

<!-- WAVE 2 -->

- [x] T4. **Google OAuth setup** — `quick`
  Add Google OAuth login using `ueberauth` + `ueberauth_google`. Wire it to create/find users in the Accounts context on successful OAuth callback.
  **What to do**:
  1. Add to `mix.exs`: `{:ueberauth, "~> 0.10"}` and `{:ueberauth_google, "~> 0.12"}`
  2. Run `mix deps.get`
  3. Configure ueberauth in `config/config.exs`:
     ```elixir
     config :ueberauth, Ueberauth,
       providers: [google: {Ueberauth.Strategy.Google, []}]
     config :ueberauth, Ueberauth.Strategy.Google.OAuth,
       client_id: System.get_env("GOOGLE_CLIENT_ID"),
       client_secret: System.get_env("GOOGLE_CLIENT_SECRET")
     ```
  4. Create `lib/open_party_web/controllers/auth_controller.ex` with `request/2` and `callback/2` actions
  5. In `callback/2`: use `%Ueberauth.Auth{}` to find or create user by email in Accounts context. Add `Accounts.find_or_create_from_oauth/1` function.
  6. Add migration if needed: `oauth_provider` and `oauth_uid` nullable columns on users
  7. Add routes in router: `get "/auth/:provider", AuthController, :request` and `get "/auth/:provider/callback", AuthController, :callback`
  8. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.example` with placeholder values
  **Must NOT do**: Do not hardcode credentials. Do not break existing email/password flow.
  **Verify**: `mix compile` succeeds. Auth routes exist in `mix phx.routes`.

- [x] T5. **GitHub OAuth setup** — `quick`
  Add GitHub OAuth login using `ueberauth_github`. Reuse the `AuthController` created in T4.
  **What to do**:
  1. Add to `mix.exs`: `{:ueberauth_github, "~> 0.8"}`
  2. Run `mix deps.get`
  3. Extend ueberauth config in `config/config.exs`:
     ```elixir
     config :ueberauth, Ueberauth,
       providers: [
         google: {Ueberauth.Strategy.Google, []},
         github: {Ueberauth.Strategy.Github, [default_scope: "user:email"]}
       ]
     config :ueberauth, Ueberauth.Strategy.Github.OAuth,
       client_id: System.get_env("GITHUB_CLIENT_ID"),
       client_secret: System.get_env("GITHUB_CLIENT_SECRET")
     ```
  4. The existing `AuthController.callback/2` should already handle both providers via the `%Ueberauth.Auth{}` struct — verify it handles GitHub's email being in `info.email`
  5. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env.example`
  **Must NOT do**: Do not create a separate controller for GitHub. Reuse `AuthController`.
  **Verify**: `mix compile` succeeds. GitHub auth routes appear in `mix phx.routes`.

- [x] T6. **Room schema + context + migrations** — `unspecified-high`
  Create the Rooms context with the Room schema. This is the Postgres layer — persistent room metadata only. No live playback state here.
  **What to do**:
  1. Generate context: `mix phx.gen.context Rooms Room rooms title:string status:string creator_user_id:references:users host_user_id:references:users` — NOTE: omit `:uuid` type prefix; with `--binary-id` set at project level, Ecto handles UUID automatically for foreign keys. Manually add `type: :binary_id` to the migration foreign key columns if generated incorrectly.
  2. Edit the generated migration to add:
     - `add :invite_code, :string, null: false` (6-char unique alphanumeric)
     - `create unique_index(:rooms, [:invite_code])`
     - `modify :title, :string, null: true` (title is optional)
     - `modify :status, :string, null: false, default: "active"`
     - `add :media_url, :string, null: true` (what URL the room is watching)
  3. Edit `lib/open_party/rooms/room.ex` schema to match
  4. In `lib/open_party/rooms.ex` context, add these public functions:
     - `create_room(attrs)` — generates unique 6-char invite code, retries on collision
     - `get_room!(id)` — fetch by UUID
     - `get_room_by_invite_code(code)` — fetch by invite code, returns `{:ok, room}` or `{:error, :not_found}`
     - `list_rooms_for_user(user_id)` — list rooms created by a user
  5. Invite code generation helper: `for _ <- 1..6, into: "", do: <<Enum.random(~c"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")>>`
  6. Retry logic: wrap insert in rescue for `Ecto.ConstraintError`, regenerate and retry up to 5 times
  7. Run `mix ecto.migrate`
  **Must NOT do**: Do not add room_members table. Do not store playback state in Postgres. Do not over-engineer the context.
  **Verify**: `mix compile` succeeds. `mix ecto.migrate` runs clean.

- [x] T7. **Swoosh email configuration** — `quick`
  Configure Swoosh for real email delivery. Use Swoosh's Mailgun adapter as default (configurable). Confirmation emails are generated by phx.gen.auth — just wire up the mailer.
  **What to do**:
  1. Add `{:swoosh, "~> 1.17"}` and `{:mail_gun, "~> 0.1"}` — actually use `{:swoosh, "~> 1.17"}` with the built-in Mailgun adapter (no extra package needed)
  2. Create `lib/open_party/mailer.ex` using `Swoosh.Mailer` if not already generated
  3. In `config/config.exs`, set mailer adapter placeholder:
     ```elixir
     config :open_party, OpenParty.Mailer, adapter: Swoosh.Adapters.Local
     ```
  4. In `config/runtime.exs`, read env and configure production adapter:
     ```elixir
     if config_env() == :prod do
       config :open_party, OpenParty.Mailer,
         adapter: Swoosh.Adapters.Mailgun,
         api_key: System.fetch_env!("MAILGUN_API_KEY"),
         domain: System.fetch_env!("MAILGUN_DOMAIN")
     end
     ```
  5. Add `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` to `.env.example`
  6. Verify dev mailbox is accessible at `/dev/mailbox` (Swoosh local adapter provides this)
  **Must NOT do**: Do not hardcode credentials. Do not break existing test setup.
  **Verify**: `mix compile` succeeds. Swoosh local adapter is active in dev.

- [x] T8. **RoomState + RoomServer GenServer** — `deep`
  Implement the core in-memory room state. This is the authoritative source of truth for playback. One GenServer per active room. Strictly follows the spec's state model.
  **What to do**:
  1. Create `lib/open_party/rooms/room_state.ex`:
     ```elixir
     defmodule OpenParty.Rooms.RoomState do
       @type playback_state :: :playing | :paused
       defstruct [
         :room_id, :host_user_id, :media_id,
         :playback_state, :base_position_ms,
         :last_updated_at_ms, :playback_rate,
         :revision
       ]
     end
     ```
  2. Create `lib/open_party/rooms/room_server.ex` as a GenServer:
     - `start_link(room_id)` — starts under Registry name `{:via, Registry, {OpenParty.RoomRegistry, room_id}}`
     - `init(room_id)` — load room from DB via `Rooms.get_room!(room_id)`, set `host_user_id` from `room.creator_user_id`, initialize state
     - `handle_call({:snapshot}, ...)` — return current snapshot
     - `handle_call({:play, user_id, position_ms, media_id}, ...)` — validate host, update state, broadcast, return snapshot
     - `handle_call({:pause, user_id, position_ms}, ...)` — same pattern
     - `handle_call({:seek, user_id, position_ms}, ...)` — same pattern
     - `handle_call({:sync_check, user_id, position_ms, revision}, ...)` — compare client position to authoritative, return corrective snapshot if drift > 1200ms
     - Private `authorize_host/2` — returns `:ok` or `{:error, :forbidden}`
     - Private `current_position_ms/1` — if paused: `base_position_ms`; if playing: `base_position_ms + (now_ms() - last_updated_at_ms) * playback_rate`
     - Private `snapshot/1` — returns map with all fields, uses `current_position_ms/1` for `base_position_ms`
     - Private `bump_revision/1` — increments `:revision` by 1
     - Private `broadcast_update/2` — calls `OpenPartyWeb.Endpoint.broadcast!("room:" <> room_id, "playback_updated", payload)`
     - Private `now_ms/0` — `System.system_time(:millisecond)`
  3. Public API module functions (call GenServer):
     - `get_snapshot(room_id)`
     - `play(room_id, user_id, position_ms, media_id \\ nil)`
     - `pause(room_id, user_id, position_ms)`
     - `seek(room_id, user_id, position_ms)`
     - `sync_check(room_id, user_id, position_ms, revision)`
  4. Validation in each command: position_ms must be non-negative integer. Return `{:error, :invalid_position}` if not.
  **Must NOT do**: Do not write playback state to Postgres. Do not add chat or any non-playback state. Do not use `GenServer.cast` for commands that need a response. Do not start the supervisor here.
  **Verify**: `mix compile` succeeds. Manual smoke test in `iex -S mix`: start a RoomServer process, call play/pause/seek, verify state.

<!-- WAVE 3 -->

- [x] T9. **RoomSupervisor + RoomRegistry + RoomManager** — `unspecified-high`
  Wire up the process management layer. DynamicSupervisor to spawn room processes, Registry to find them, and a RoomManager public API.
  **What to do**:
  1. Create `lib/open_party/rooms/room_registry.ex`:
     ```elixir
     defmodule OpenParty.RoomRegistry do
       def child_spec(_), do: Registry.child_spec(keys: :unique, name: __MODULE__)
       def via(room_id), do: {:via, Registry, {__MODULE__, room_id}}
     end
     ```
  2. Create `lib/open_party/rooms/room_supervisor.ex` as a `DynamicSupervisor`:
     ```elixir
     defmodule OpenParty.RoomSupervisor do
       use DynamicSupervisor
       def start_link(_), do: DynamicSupervisor.start_link(__MODULE__, :ok, name: __MODULE__)
       def init(:ok), do: DynamicSupervisor.init(strategy: :one_for_one)
       def start_room(room_id) do
         DynamicSupervisor.start_child(__MODULE__, {OpenParty.Rooms.RoomServer, room_id})
       end
     end
     ```
  3. Add both to `lib/open_party/application.ex` supervision tree (before endpoint)
  4. Create `lib/open_party/rooms/room_manager.ex` as the public API:
     - `start_or_get_room(room_id)` — look up in Registry; if found, return `{:ok, pid}`; if not, call `RoomSupervisor.start_room/1`; handle `{:error, {:already_started, pid}}` from race condition
     - Verify room exists in DB before starting process — return `{:error, :room_not_found}` if not
  5. Update `RoomServer` to use `RoomRegistry.via(room_id)` as its name
  **Must NOT do**: Do not add restart strategies beyond `:one_for_one`. Do not persist GenServer state to DB on crash. Do not add a custom process monitor.
  **Verify**: `mix compile` succeeds. In `iex -S mix`, call `RoomManager.start_or_get_room(some_uuid)` — it should start a process. Call it again — should return existing pid.

- [x] T10. **Room HTTP API endpoints** — `quick`
  Add the three room HTTP endpoints. Requires authentication (bearer token from T12 — implement auth plug here as a placeholder that T12 will fill in).
  **What to do**:
  1. Create `lib/open_party_web/controllers/room_controller.ex` with:
     - `create/2` — `POST /api/rooms`. Requires auth. Creates room with `creator_user_id` = current user id, `host_user_id` = same. Returns `{room_id, invite_code, title, status}`
     - `show/2` — `GET /api/rooms/:id`. Returns room metadata (no live state). Returns 404 if not found.
     - `show_by_code/2` — `GET /api/rooms/code/:code`. Looks up by invite code. Returns same shape as show.
  2. Add routes in `router.ex` under `/api` scope:
     ```elixir
     scope "/api", OpenPartyWeb do
       pipe_through :api
       get "/health", HealthController, :index
       scope "/rooms" do
         post "/", RoomController, :create
         get "/code/:code", RoomController, :show_by_code
         get "/:id", RoomController, :show
       end
     end
     ```
  3. Add JSON response helpers — use `json(conn, ...)` not custom views
  4. For `create/2`, call `Rooms.create_room(%{title: params["title"], creator_user_id: current_user.id, host_user_id: current_user.id})`
  **Must NOT do**: Do not add pagination. Do not return playback state from HTTP. Do not add PUT/PATCH/DELETE endpoints.
  **Verify**: `mix compile` succeeds. Route table correct via `mix phx.routes`.

- [x] T11. **Socket auth + RoomChannel join + Presence** — `deep`
  Implement the authenticated WebSocket socket and the RoomChannel. Users must authenticate the socket with a valid bearer token. On join, send snapshot and track presence.
  **What to do**:
  1. Create or update `lib/open_party_web/channels/user_socket.ex`:
     - `connect/3` receives `%{"token" => token}` in params
     - Verify token via `Accounts.fetch_user_by_api_token(token)` — return `{:ok, socket}` with `user_id` and `display_name` assigned, or `{:error, %{reason: "unauthorized"}}`
     - `id/1` returns `"users_socket:#{socket.assigns.user_id}"`
  2. Create `lib/open_party_web/presence.ex`:
     ```elixir
     defmodule OpenPartyWeb.Presence do
       use Phoenix.Presence, otp_app: :open_party, pubsub_server: OpenParty.PubSub
     end
     ```
  3. Add `OpenPartyWeb.Presence` to supervision tree in `application.ex`
  4. Create `lib/open_party_web/channels/room_channel.ex`:
     - `join("room:" <> room_id, _params, socket)` — call `RoomManager.start_or_get_room(room_id)`. If `{:error, :room_not_found}`, return `{:error, %{reason: "room_not_found"}}`. Send `self()` message `:after_join`. Return `{:ok, socket}` with `room_id` assigned.
     - `handle_info(:after_join, socket)` — track presence: `Presence.track(socket, socket.assigns.user_id, %{display_name: socket.assigns.display_name, joined_at: System.system_time(:second)})`. Push snapshot: `push(socket, "snapshot", RoomServer.get_snapshot(room_id))`. Return `{:noreply, socket}`.
     - Handle `"play"`, `"pause"`, `"seek"`, `"request_snapshot"`, `"sync_check"` — see T13/T14
  5. Register channel in `user_socket.ex`: `channel "room:*", OpenPartyWeb.RoomChannel`
  6. Add socket to endpoint in `endpoint.ex`: `socket "/socket", OpenPartyWeb.UserSocket, websocket: true, longpoll: false`
  **Must NOT do**: Do not allow unauthenticated socket connections. Do not skip the `:after_join` send pattern for Presence. Do not call `Presence.track` directly in `join/3`.
  **Verify**: `mix compile` succeeds. Write a manual channel test stub to verify join works.

- [x] T12. **API bearer token auth** — `quick`
  Wire up bearer token authentication for HTTP API endpoints. `phx.gen.auth` generated the token table — add the API token creation endpoint and the plug.
  **What to do**:
  1. Add `create_user_api_token/1` to `Accounts` context if not already generated (check — phx.gen.auth 1.8 may have generated it)
  2. Create `lib/open_party_web/controllers/token_controller.ex`:
     - `POST /api/tokens` — user posts email + password, gets back a bearer token. Or: generates token for already-authenticated user session.
     - Simpler approach: add `POST /api/tokens` that creates token from valid user credentials
  3. Add `fetch_current_scope_for_api_user/2` plug to `lib/open_party_web/user_auth.ex` (may already be generated — check hexdocs pattern):
     ```elixir
     def fetch_current_scope_for_api_user(conn, _opts) do
       with [<<"Bearer ", token::binary>>] <- get_req_header(conn, "authorization"),
            {:ok, user} <- Accounts.fetch_user_by_api_token(token) do
         assign(conn, :current_scope, %{user: user})
       else
         _ -> conn |> send_resp(:unauthorized, "") |> halt()
       end
     end
     ```
  4. Add `:api_auth` pipeline in router with this plug
  5. Move `RoomController` routes under the `:api_auth` pipeline
  6. Add `POST /api/tokens` route to unauthenticated API scope
  **Must NOT do**: Do not use sessions for API auth. Do not build a full OAuth server.
  **Verify**: `mix compile` succeeds. `curl POST /api/tokens` with valid credentials returns a token. `curl POST /api/rooms` with token in Authorization header works.

<!-- WAVE 4 -->

- [x] T13. **Playback commands (play/pause/seek)** — `deep`
  Implement the playback command handlers in RoomChannel. These are the core of the protocol — host sends a command, server validates authority, updates state, broadcasts to all clients.
  **What to do**:
  1. In `room_channel.ex`, add `handle_in/3` for `"play"`:
     ```elixir
     def handle_in("play", %{"position_ms" => position_ms} = params, socket) do
       case RoomServer.play(socket.assigns.room_id, socket.assigns.user_id, position_ms, params["media_id"]) do
         {:ok, snapshot} -> {:reply, {:ok, snapshot}, socket}
         {:error, :forbidden} -> {:reply, {:error, %{code: "forbidden", message: "Only the host can control playback"}}, socket}
         {:error, :invalid_position} -> {:reply, {:error, %{code: "invalid_position", message: "position_ms must be a non-negative integer"}}, socket}
       end
     end
     ```
  2. Add `handle_in/3` for `"pause"` — same pattern, `position_ms` required
  3. Add `handle_in/3` for `"seek"` — same pattern, `position_ms` required
  4. Add fallback `handle_in/3` for missing position_ms: pattern match on payload without `"position_ms"` → return `{:error, %{code: "missing_field", message: "position_ms is required"}}`
  5. `broadcast!` in RoomServer already sends `playback_updated` to the room topic — verify it broadcasts with `changed_by: user_id` in the payload
  **Must NOT do**: Do not allow non-host commands to silently succeed. Do not skip the `changed_by` field in broadcast. Do not call `Repo` from the channel.
  **Verify**: `mix compile` succeeds. Channel test: host sends play → all clients receive `playback_updated`. Non-host sends play → receives `{code: "forbidden"}` error.

- [x] T14. **Snapshot + sync_check + drift correction** — `deep`
  Implement `request_snapshot` and `sync_check` handlers. This is the resync mechanism.
  **What to do**:
  1. In `room_channel.ex`, add `handle_in/3` for `"request_snapshot"`:
     ```elixir
     def handle_in("request_snapshot", _params, socket) do
       snapshot = RoomServer.get_snapshot(socket.assigns.room_id)
       {:reply, {:ok, snapshot}, socket}
     end
     ```
  2. Add `handle_in/3` for `"sync_check"` with payload `%{"position_ms" => _, "last_applied_revision" => _}`:
     - Call `RoomServer.sync_check(room_id, user_id, position_ms, revision)`
     - If drift > 1200ms or revision stale: return `{:reply, {:ok, %{corrective_snapshot: snapshot}}, socket}`
     - If drift <= 250ms: return `{:reply, {:ok, %{status: "in_sync"}}, socket}`
     - If 250ms < drift <= 1200ms: return `{:reply, {:ok, %{status: "minor_drift", drift_ms: drift}}, socket}` (client may self-correct)
  3. In `RoomServer.handle_call({:sync_check, ...})`, compute drift:
     ```elixir
     authoritative_pos = current_position_ms(state)
     drift = abs(authoritative_pos - client_position_ms)
     cond do
       drift <= 250 -> {:reply, {:ok, :in_sync}, state}
       drift <= 1200 -> {:reply, {:ok, {:minor_drift, drift}}, state}
       true -> {:reply, {:ok, {:corrective_snapshot, snapshot(state)}}, state}
     end
     ```
  4. Update the `snapshot/1` private function to always compute `current_position_ms` correctly for both playing and paused states
  **Must NOT do**: Do not implement playback rate correction (not in MVP). Do not broadcast on sync_check — it's a per-client response only.
  **Verify**: `mix compile` succeeds. Channel test: client sends sync_check with large drift → receives corrective snapshot. Client with small drift → receives in_sync.

- [x] T15. **Inactivity timeout + room cleanup** — `unspecified-high`
  Add idle timeout to room processes so they terminate after 15 minutes with no connected users. Use Presence to detect when a room is empty.
  **What to do**:
  1. In `room_channel.ex`, `terminate/2` — when a user disconnects (channel terminated), check if room is now empty:
     ```elixir
     def terminate(_reason, socket) do
       # Presence cleanup is automatic; check if room empty after a delay
       Process.send_after(self(), :check_room_empty, 1_000)
       :ok
     end
     ```
     Actually, use the simpler approach: set a GenServer timeout in the RoomServer.
  2. In `RoomServer.init/1`, subscribe to Presence events for this room topic via `Phoenix.PubSub.subscribe(OpenParty.PubSub, "room:" <> room_id)`
  3. Add `handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff", payload: %{leaves: leaves}}, state)` in RoomServer — if presence is now empty (all users left), start a countdown timer:
     ```elixir
     @idle_timeout_ms 15 * 60 * 1_000  # 15 minutes
     # store timer ref in state, cancel if someone joins
     ```
  4. Add `handle_info(:idle_timeout, state)` — calls `DynamicSupervisor.terminate_child/2` on self, or simply `{:stop, :normal, state}`
  5. On Presence join (user enters), cancel any pending idle timer
  6. Add `@idle_timeout_ms` as a module attribute for easy configuration
  **Must NOT do**: Do not terminate the room if a user is still connected. Do not write anything to DB on timeout.
  **Verify**: `mix compile` succeeds. Unit test: start room process, verify alive, simulate 0 presence users + wait past short test timeout, assert process terminated.

<!-- WAVE 5 -->

- [ ] T16. **RoomServer unit tests** — `unspecified-high`
  Write ExUnit tests for all RoomServer logic. These must cover every behavior specified in the acceptance criteria.
  **What to do**:
  Create `test/open_party/rooms/room_server_test.exs`. Use `start_supervised!({RoomServer, room_id})` to start processes in test isolation. Test cases:
  1. `initializes room state correctly` — new server has revision 0, playback_state :paused, base_position_ms 0
  2. `host can play` — call `RoomServer.play(room_id, host_id, 5000)` → returns `{:ok, snapshot}` with playback_state :playing
  3. `host can pause` — call `RoomServer.pause(room_id, host_id, 5000)` → returns `{:ok, snapshot}` with playback_state :paused
  4. `host can seek` — call `RoomServer.seek(room_id, host_id, 30000)` → returns `{:ok, snapshot}` with base_position_ms 30000
  5. `non-host cannot control playback` — call play with non-host user_id → returns `{:error, :forbidden}`
  6. `revision increments on every valid update` — play → pause → seek → assert revision is 3
  7. `snapshot computes current position correctly while playing` — play at position 0, wait 100ms, get snapshot, assert base_position_ms >= 100
  8. `paused snapshot returns base position unchanged` — pause at position 5000, wait 100ms, get snapshot, assert base_position_ms == 5000
  9. `sync_check returns in_sync for small drift` — play at 0, sync_check with position 100 → :in_sync
  10. `sync_check returns corrective snapshot for large drift` — play at 0, sync_check with position 99999 → corrective_snapshot
  11. `stale revision update is rejected` — implement if applicable in sync_check: client reports revision 5, server is at 10 → force resync
  **Must NOT do**: Do not use Mox or mock the DB — use real Ecto sandbox. Do not test private functions directly.
  **Verify**: `mix test test/open_party/rooms/room_server_test.exs` passes with 0 failures.

- [ ] T17. **RoomChannel tests** — `unspecified-high`
  Write ExUnit tests for the RoomChannel using `Phoenix.ChannelTest`.
  **What to do**:
  Create `test/open_party_web/channels/room_channel_test.exs`. Setup: create a user fixture, create a room fixture, connect socket with valid user token, join the room channel. Test cases:
  1. `client can join valid room channel` — join `"room:#{room_id}"` → `:ok` reply
  2. `join returns snapshot` — join channel → assert_push `"snapshot"` with fields: room_id, playback_state, revision, base_position_ms
  3. `play event updates room and broadcasts` — push `"play"` with position_ms → assert_broadcast `"playback_updated"` with playback_state: "playing"
  4. `pause event updates room and broadcasts` — push `"pause"` with position_ms → assert_broadcast `"playback_updated"` with playback_state: "paused"
  5. `seek event updates room and broadcasts` — push `"seek"` with position_ms → assert_broadcast `"playback_updated"` with correct position
  6. `non-host command returns forbidden error` — connect second user socket, join same room, push `"play"` → assert reply `{:error, %{code: "forbidden"}}`
  7. `request_snapshot returns current snapshot` — push `"request_snapshot"` → assert reply `{:ok, snapshot}`
  8. `sync_check with large drift returns corrective snapshot` — play at 0, sync_check with 99999 → assert reply contains corrective_snapshot
  9. `join fails for non-existent room` — join `"room:non-existent-uuid"` → `{:error, %{reason: "room_not_found"}}`
  10. `presence is tracked on join` — join channel → `OpenPartyWeb.Presence.list("room:#{room_id}")` contains user
  **Must NOT do**: Do not use real HTTP requests for channel tests. Do not test socket connect in channel tests (separate concerns).
  **Verify**: `mix test test/open_party_web/channels/room_channel_test.exs` passes with 0 failures.

- [ ] T18. **HTTP endpoint + auth tests** — `unspecified-high`
  Write ExUnit tests for HTTP endpoints and auth flows.
  **What to do**:
  Create `test/open_party_web/controllers/room_controller_test.exs` and `test/open_party_web/controllers/token_controller_test.exs`. Test cases:
  1. `room creation endpoint works` — POST /api/rooms with valid bearer token → 201 with room_id, invite_code
  2. `room creation requires auth` — POST /api/rooms without token → 401
  3. `room fetch by ID works` — GET /api/rooms/:id → 200 with room metadata
  4. `room fetch 404 for unknown ID` — GET /api/rooms/bad-uuid → 404
  5. `room fetch by invite code works` — GET /api/rooms/code/:code → 200 with room_id
  6. `invite code 404 for unknown code` — GET /api/rooms/code/XXXXXX → 404
  7. `health endpoint returns ok` — GET /api/health → 200 `{"status": "ok"}`
  8. `token creation works` — POST /api/tokens with valid email/password → 200 with token string
  9. `token creation fails with bad credentials` — POST /api/tokens with wrong password → 401
  **Must NOT do**: Do not test LiveView auth pages here (that's covered by generated tests). Do not test OAuth callback with real providers.
  **Verify**: `mix test test/open_party_web/controllers/` passes with 0 failures.

- [ ] T19. **Railway deployment config** — `quick`
  Add Dockerfile and `config/runtime.exs` for Railway deployment. Multi-stage build using Elixir releases.
  **What to do**:
  1. Create `Dockerfile` using the official Phoenix release Dockerfile pattern:
     ```dockerfile
     # Stage 1: Build
     FROM elixir:1.19.3-otp-28-alpine AS builder
     ENV MIX_ENV=prod
     WORKDIR /app
     RUN apk add --no-cache build-base git
     COPY mix.exs mix.lock ./
     RUN mix local.hex --force && mix local.rebar --force
     RUN mix deps.get --only prod
     RUN mix deps.compile
     COPY config config/
     COPY lib lib/
     COPY priv priv/
     RUN mix compile
     RUN mix assets.deploy 2>/dev/null || true
     RUN mix phx.gen.release 2>/dev/null || true
     RUN mix release
     # Stage 2: Runtime
     FROM alpine:3.21 AS runner
     RUN apk add --no-cache libgcc libstdc++ ncurses-libs openssl
     WORKDIR /app
     COPY --from=builder /app/_build/prod/rel/open_party ./
     EXPOSE 4000
     CMD ["bin/open_party", "start"]
     ```
  2. Create `.dockerignore` to exclude deps/, _build/, .git/
  3. Ensure `config/runtime.exs` reads from env:
     ```elixir
     config :open_party, OpenPartyWeb.Endpoint,
       url: [host: System.get_env("PHX_HOST") || "localhost"],
       http: [port: String.to_integer(System.get_env("PORT") || "4000")],
       secret_key_base: System.fetch_env!("SECRET_KEY_BASE")
     config :open_party, OpenParty.Repo,
       url: System.fetch_env!("DATABASE_URL"),
       pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10")
     ```
  4. Create `.env.example` with all required env vars: `DATABASE_URL`, `SECRET_KEY_BASE`, `PHX_HOST`, `PORT`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  5. Add `railway.toml` or document Railway setup:
     ```toml
     [build]
     builder = "DOCKERFILE"
     [deploy]
     startCommand = "bin/open_party start"
     healthcheckPath = "/api/health"
     ```
  **Must NOT do**: Do not include secrets in the Dockerfile. Do not hardcode DATABASE_URL.
  **Verify**: `docker build -t openparty .` succeeds from repo root.

- [ ] T20. **Invite code generation + lookup** — `quick`
  Verify and polish the invite code system. This task ensures the full invite code flow works end-to-end (create room → get code → look up room by code).
  **What to do**:
  1. Verify `Rooms.create_room/1` generates a 6-char uppercase alphanumeric invite code
  2. Verify `unique_index` on `invite_code` is in the migration
  3. Verify `Rooms.get_room_by_invite_code/1` returns `{:ok, room}` or `{:error, :not_found}`
  4. Verify `GET /api/rooms/code/:code` endpoint works (from T10)
  5. Write one integration test: create room → get invite code → look up by code → assert same room_id returned
  6. Ensure invite code is always returned in room creation response: `{"room_id": "...", "invite_code": "ABC123", "title": null, "status": "active"}`
  **Must NOT do**: Do not change invite code length from 6 chars. Do not add a separate invite code table.
  **Verify**: `mix test` passes. Integration test in test file confirms the full code flow.
---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `mix compile --warnings-as-errors` + `mix test`. Review all changed files for: `@spec` on public functions, proper error handling with `with` chains, no `IO.inspect` in prod code, no commented-out code, no unused imports/aliases. Check AI slop: excessive `@doc` on obvious functions, over-abstraction, generic variable names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Full QA Run** — `unspecified-high`
  Start Postgres via Docker. Run `mix ecto.create && mix ecto.migrate`. Start Phoenix server. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (auth → create room → join channel → playback). Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual implementation. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task(s) | Commit Message | Pre-commit Check |
|---|---|---|
| 1 | `feat: scaffold Phoenix project with Postgres` | `mix compile` |
| 2 | `feat: add CORS support and health endpoint` | `mix compile` |
| 3 | `feat: add user authentication (phx.gen.auth)` | `mix test` |
| 4,5 | `feat: add Google and GitHub OAuth login` | `mix test` |
| 6 | `feat: add room schema and context` | `mix test` |
| 7 | `feat: configure Swoosh email delivery` | `mix compile` |
| 8 | `feat: implement RoomState and RoomServer GenServer` | `mix compile` |
| 9 | `feat: add room supervisor, registry, and manager` | `mix compile` |
| 10,12 | `feat: add room HTTP API with bearer auth` | `mix compile` |
| 11 | `feat: implement RoomChannel with presence tracking` | `mix compile` |
| 13 | `feat: implement play/pause/seek playback commands` | `mix compile` |
| 14 | `feat: add snapshot, sync_check, and drift correction` | `mix compile` |
| 15 | `feat: add room inactivity timeout and cleanup` | `mix compile` |
| 16,17,18 | `test: add room server, channel, and HTTP tests` | `mix test` |
| 19 | `feat: add Railway deployment config` | `docker build .` |
| 20 | `feat: add invite code generation and lookup` | `mix test` |

---

## Success Criteria

### Verification Commands
```bash
mix compile --warnings-as-errors  # Expected: Compilation succeeds, 0 warnings
mix test                          # Expected: All tests pass, 0 failures
curl -s http://localhost:4000/api/health | jq '.status'  # Expected: "ok"
curl -s -X POST http://localhost:4000/api/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Room"}' | jq '.room_id'  # Expected: UUID
docker build -t openparty .       # Expected: Build succeeds
```

### Final Checklist
- [ ] All "Must Have" present and verified
- [ ] All "Must NOT Have" absent (no forbidden patterns)
- [ ] All tests pass (`mix test`)
- [ ] Docker image builds
- [ ] Auth flows work (register, login, OAuth)
- [ ] Room creation → channel join → playback sync works end-to-end
- [ ] Presence tracks connected users
- [ ] Invite codes work for room discovery
- [ ] Health endpoint responds
