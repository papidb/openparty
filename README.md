# OpenParty

Open-source, self-hostable alternative to Teleparty. Synchronizes video playback across multiple users in real-time.

This is a backend-only project. Each user watches content locally, the server only synchronizes playback state.

## Features

- Real-time playback sync (`play`, `pause`, `seek`) via Phoenix Channels
- Room-based sessions with shareable invite codes
- Host-only playback control
- Snapshot-based reconnect with drift correction
- Email/password plus Google and GitHub OAuth authentication
- Bearer token API authentication
- Presence tracking for room participants
- Inactivity timeout with automatic room cleanup
- Railway-ready deployment config

## Tech Stack

- Elixir 1.19+ / OTP 28
- Phoenix 1.8.5
- PostgreSQL 17
- Phoenix Channels plus Presence for real-time communication
- One GenServer per active room as authoritative state

## Prerequisites

- Elixir 1.19+ and Erlang/OTP 28
- PostgreSQL 17 (or Docker)
- Node.js (for asset building)

## Getting Started (Local Development)

1. Clone the repository.
2. Start PostgreSQL via Docker if you do not already have a local instance running:

   ```bash
   docker run -d --name openparty-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17-alpine
   ```

3. Install dependencies and set up the project:

   ```bash
   mix setup
   ```

4. Optional: set OAuth environment variables for Google and GitHub login (see Environment Variables).
5. Start the server:

   ```bash
   mix phx.server
   ```

6. Visit http://localhost:4000

Local development defaults:

- Dev database: `postgres/postgres@localhost/open_party_dev`
- Dev mailbox: `/dev/mailbox`

## Workspace Layout (Backend + Extension)

The Phoenix backend stays in place. Extension work lives beside it so we avoid risky backend refactors.

- `extension/` Chrome extension scaffold (Manifest V3, popup, background worker)
- `shared/api-client/` shared JavaScript API helpers and generated OpenAPI typings
- `shared/openapi/` pulled OpenAPI spec artifacts
- `scripts/pull-openapi.mjs` fetches `/api/openapi` into `shared/openapi/openapi.json`

Install workspace dependencies from repo root:

```bash
npm install
```

Generate shared API typings from the running backend:

```bash
npm run openapi:gen
```

If your backend is not on localhost, set:

```bash
OPENPARTY_OPENAPI_URL="https://your-host/api/openapi" npm run openapi:gen
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | prod | Postgres connection URL |
| `SECRET_KEY_BASE` | prod | Session signing key. Generate with `mix phx.gen.secret` |
| `PHX_HOST` | prod | Public hostname (for example: `your-app.railway.app`) |
| `PORT` | no | HTTP port (default: `4000`) |
| `MAILGUN_API_KEY` | prod | Mailgun API key for transactional email |
| `MAILGUN_DOMAIN` | prod | Mailgun sending domain |
| `GOOGLE_CLIENT_ID` | no | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | no | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | no | GitHub OAuth client secret |

In development, the app uses local Postgres (`postgres/postgres@localhost`) and the Swoosh local mailbox adapter. OAuth is optional for local development.

## API Endpoints

### `GET /api/health`

Health check endpoint.

Response:

```json
{"status":"ok"}
```

### `POST /api/tokens`

Exchange email and password for a bearer token.

Request body:

```json
{"email":"user@example.com","password":"your-password"}
```

Response:

```json
{"token":"..."}
```

### `POST /api/rooms`

Create a room. Requires `Authorization: Bearer <token>`.

Response:

```json
{"room_id":"...","invite_code":"...","status":"active"}
```

### `GET /api/rooms/:id`

Get a room by ID. Requires `Authorization: Bearer <token>`.

### `GET /api/rooms/code/:invite_code`

Get a room by invite code. Requires `Authorization: Bearer <token>`.

## WebSocket Protocol

- Connect with bearer token:

  ```text
  ws://localhost:4000/socket/websocket?token=<bearer_token>
  ```

- Join topic: `room:<room_id>`
- On join, server pushes `snapshot` with current playback state

Client events:

- Host only:
  - `play` with `{"position_ms": <int>}` and optional `"media_id"`
  - `pause` with `{"position_ms": <int>}`
  - `seek` with `{"position_ms": <int>}`
- Any participant:
  - `request_snapshot`
  - `sync_check` with `{"position_ms": <int>, "last_applied_revision": <int>}`

Server messages:

- Broadcast `playback_updated` payload includes `playback_state`, `base_position_ms`, `revision`, and `changed_by`
- Reply to `sync_check` is one of:
  - `{"status": "in_sync"}`
  - `{"status": "minor_drift", "drift_ms": <int>}`
  - `{"corrective_snapshot": {...}}`

## Authentication

- Email and password registration: `/users/register`
- Login: `/users/log-in`
- Google OAuth: `/auth/google`
- GitHub OAuth: `/auth/github`

Email confirmation is disabled by default. To enable it, uncomment `plug :require_confirmed_user` in `lib/open_party_web/router.ex`.

## Running Tests

```bash
mix test
```

For CI with a longer timeout:

```bash
mix test --timeout 10000
```

## Deployment (Railway)

- The project includes a `Dockerfile` and `railway.toml` for Railway deployment
- Set all required environment variables from the Environment Variables section
- Set `PHX_SERVER=true` in your Railway service configuration
- Generate `SECRET_KEY_BASE` with:

  ```bash
  mix phx.gen.secret
  ```

## License

See LICENSE file.
