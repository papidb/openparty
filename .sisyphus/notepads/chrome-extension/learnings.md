# Chrome Extension Plan — Learnings

## Project Structure
- Phoenix backend at repo root
- Extension scaffold at `extension/` (to be replaced by WXT)
- Shared API helpers at `shared/api-client/src/client.js`
- Root workspace: `package.json` with workspaces: `["extension", "shared/api-client"]`

## Backend Notes
- WebSocket socket at `/socket/websocket?token=<token>`
- Room channel topic: `room:<room_id>`
- `check_origin` not set in runtime.exs prod block — blocks chrome-extension://
- `mix test` expected: 154 tests, 0 failures

## API Contract
- `POST /api/tokens` → `{token}`
- `POST /api/rooms` (Bearer) → `{room_id, invite_code, status}`
- `GET /api/rooms/:id` (Bearer) → room details
- `GET /api/rooms/code/:invite_code` (Bearer) → room details

## Extension Architecture
- WXT + React + TypeScript + Tailwind v4
- NO tailwind.config.js (v4 uses CSS imports)
- NO daisyUI, no @apply
- Shadow DOM for sidebar CSS isolation
- chrome.storage.local for token persistence
- Background service worker for WebSocket
- Content script for video detection + sidebar injection

## Task 4 API Client Update
- Added `createRoom(apiBase, token)` in `shared/api-client/src/client.js` using fetch POST `/api/rooms` with Bearer auth, non-ok error handling, and JSON response return.
- Added `getRoomById(apiBase, token, roomId)` in `shared/api-client/src/client.js` using fetch GET `/api/rooms/${roomId}` with Bearer auth, non-ok error handling, and JSON response return.
- Preserved existing `createToken` and `getRoomByInviteCode` implementations unchanged.

## [2026-03-08] T1: Backend check_origin added to runtime.exs prod Endpoint config

## [2026-03-08] T2: WXT React+TypeScript+Tailwind v4 initialized
- Replaced old MV3 scaffold files in extension/ with WXT structure (entrypoints/, wxt.config.ts, tsconfig.json, assets/tailwind.css).
- Confirmed React module wiring in WXT 0.20 uses modules: ["@wxt-dev/module-react"] string module id, not react() call style.
- Tailwind v4 works via CSS import (@import "tailwindcss";) without any tailwind.config.js.
- npx wxt build generated MV3 manifest with manifest_version 3 and requested permissions plus host_permissions.

## [2026-03-08] T3: Phoenix Socket in MV3 service worker
- `phoenix` v1.8.5 import is compatible with background service worker when used from `extension/entrypoints/background.ts`.
- Phoenix global resolution uses `self || window || globalThis`; no unguarded `window` dependency for socket creation path.
- `document.visibilityState` exists in library code but is inside a `phxWindow` event-listener guard, so it does not execute in service worker.
- Architectural decision: keep Phoenix socket client in background worker and force `transport: WebSocket` to avoid LongPoll/XHR transport fallback.
- WXT build verification passed (`npx wxt build`, exit 0) with compiled `.output/chrome-mv3/background.js`.

## [2026-03-08] T7: Content script video detection + playback event bridge
- `extension/entrypoints/content.ts` uses `defineContentScript({ matches: ["<all_urls>"] })` so it runs universally without site-specific selectors.
- Video targeting uses "largest visible" heuristic over all `<video>` elements and swaps listeners when the active element changes.
- MutationObserver on `document.body || document.documentElement` plus initial check handles post-load dynamic video insertion.
- Status relay sends `VIDEO_STATUS` only when detected boolean changes to avoid noisy runtime messaging.
- Host role emits `HOST_EVENT` on native `play`, `pause`, and `seeked`; guest role applies `PLAYBACK_UPDATE` and runs periodic `SYNC_CHECK` with `lastRevision` tracking.

## [2026-03-08] T6: Background room session manager
- Implemented full MV3 background session manager in `extension/entrypoints/background.ts` for `JOIN_ROOM`, `LEAVE_ROOM`, `HOST_EVENT`, `SYNC_CHECK`, and `GET_SESSION_STATE` runtime messages.
- Socket lifecycle now disconnects prior sessions, connects with Phoenix `Socket` using `{ transport: WebSocket }`, joins `room:<room_id>`, and re-joins on socket open if channel is not joined.
- Join snapshot handling supports both join `receive("ok")` payload and server-pushed `snapshot` event, storing playback state and broadcasting `ROOM_JOINED` plus `PLAYBACK_UPDATE`.
- Presence handling supports Phoenix `presence_state` maps with `metas` arrays and `presence_diff` joins/leaves, then broadcasts normalized `PRESENCE_UPDATE` participants with host flag derived from `host_user_id`.
- Added local TS declaration expansion in `extension/types/background-env.d.ts` for Phoenix `Socket`, `Channel`, and `Push` APIs used by the background worker.
- `GET_SESSION_STATE` responds to caller and also broadcasts `SESSION_STATE` to active extension contexts for immediate UI synchronization.

## [2026-03-08] T5: Popup UI state machine and controls
- Split popup into dedicated `App.tsx` and mount-only `main.tsx` entrypoint to keep UI logic isolated from bootstrap.
- Implemented three-view state machine (`login` -> `lobby` -> `in-room`) driven by persisted `token` and `activeRoom` from `chrome.storage.local`.
- Reused shared workspace API client (`@openparty/api-client`) for token creation, room creation, and invite-code lookup; added local declaration file in `extension/types/api-client.d.ts` for strict TS compatibility.
- Lint rule in popup enforces non-literal `id` props; using constant variables preserves stable E2E selectors while satisfying lint constraints.
- Lobby includes live `VIDEO_STATUS` listener and room controls, while in-room provides invite link generation/copy and `LEAVE_ROOM` messaging.

## [2026-03-08] T8: Shadow DOM activity sidebar
- Added `extension/entrypoints/sidebar/mount.ts` to mount/unmount a React sidebar into `openparty-sidebar-host` Shadow DOM, preventing host-page CSS bleed.
- Added `extension/entrypoints/sidebar/sidebar.css` and loaded it with `?inline` so styles are injected directly into shadow root; includes `@import "tailwindcss"` per Tailwind v4 pattern.
- Added `extension/entrypoints/sidebar/Sidebar.tsx` with required IDs (`op-toggle-detail`, `op-sidebar-close`, `op-activity-log`, `op-participant-count`) and capped activity log at 200 entries.
- Presence activity is derived from `PRESENCE_UPDATE` diffs in component state (join/leave), while `PLAYBACK_UPDATE` contributes play/pause log entries.
- Project lint rule for JSX `id` attributes still applies in extension UI; IDs must be provided via constants (not string literals) to satisfy diagnostics.

## [2026-03-08] T9: Playback sync roles and drift correction
- `extension/entrypoints/background.ts` `SYNC_CHECK` now handles all backend reply variants: `in_sync` (no broadcast), `minor_drift` (broadcast `MINOR_DRIFT`), and `corrective_snapshot` (broadcast `CORRECTIVE_SNAPSHOT`).
- Corrective snapshots are forwarded verbatim from channel reply payload to content scripts to preserve authoritative server state shape (`playback_state`, `base_position_ms`, `revision`).
- `extension/entrypoints/content.ts` now applies `CORRECTIVE_SNAPSHOT` with a tighter 200ms seek threshold and updates `lastRevision` from snapshot revision after application.
- `lastRevision` lifecycle is explicit: seeded on `ROOM_JOINED` snapshot, updated on guest `PLAYBACK_UPDATE`, and refreshed on `CORRECTIVE_SNAPSHOT`.
- Guest sync cadence remains 7s (`setInterval(doSyncCheck, 7000)`), preserving low-noise checks while still allowing authoritative corrective snapshots.

## [2026-03-08] T10: Sidebar activity feed (simple/detailed)
- `extension/entrypoints/sidebar/Sidebar.tsx` now tracks `prevParticipantsRef` and diffs `PRESENCE_UPDATE` payloads to emit explicit `join`/`leave` activity entries.
- Added a single-entry `addActivity` helper that stamps IDs/timestamps and hard-caps in-memory activity history to 200 entries.
- `PLAYBACK_UPDATE` now always emits `play`/`pause` entries and emits `seek` entries on significant position jumps (detail-mode visible only because simple filter excludes seek/sync).
- `CORRECTIVE_SNAPSHOT` now emits a `sync` activity entry with drift-correction detail.
- Added display-name safety fallback helper that normalizes blank names and email-like strings to email prefix or `Anonymous`.

## [2026-03-08] T12: Playwright E2E for extension popup/party/errors
- Added `extension/playwright.config.ts` targeting `tests/e2e` with a dedicated `chrome-extension` project and explicit action/navigation timeouts.
- Added reusable E2E helper (`extension/tests/e2e/helpers.ts`) for launching Chromium with extension flags and resolving dynamic extension ID from MV3 service worker URL.
- Extensions did not register service workers in this environment with headless mode, so launch was stabilized with `channel: "chromium"` and `headless: false`.
- Added popup tests (`popup.test.ts`) for first-open login UI selectors and invalid-credential error rendering using real popup IDs from `entrypoints/popup/App.tsx`.
- Added party tests (`party.test.ts`) with backend-aware skips and a sidebar injection assertion (`#openparty-sidebar-host`) when room join succeeds.
- Added error tests (`errors.test.ts`) for popup resilience, invalid credentials, and MV3 manifest contract checks.

## [2026-03-08] T11: Vitest unit suite for extension shared logic
- Added `extension/vitest.config.ts` with `jsdom`, globals, unit setup file, and `include: ["tests/unit/**/*.test.ts"]` so Vitest does not execute Playwright E2E specs.
- Added `extension/tests/unit/setup.ts` chrome API mock scaffold for `storage.local`, `runtime.onMessage`, and `tabs` messaging APIs used by extension code.
- Added `extension/tests/unit/api-client.test.ts` coverage for `createToken`, `createRoom`, and `getRoomByInviteCode` happy/error paths with mocked `fetch`.
- Added `extension/tests/unit/sync.test.ts` coverage for largest-visible-video selection and playback state merge behavior for partial `playback_updated` payloads.
- Added `extension/tests/unit/activity.test.ts` coverage for simple vs detailed filtering, display-name fallback to `Anonymous`, and 200-entry activity cap behavior.

## [2026-03-08] T13: Invite flow completion (auto-join + sidebar auto-open)
- Popup invite join path in `extension/entrypoints/popup/App.tsx` uses dedicated lobby form IDs `join-form`, `join-code`, and `join-submit`, with a dedicated invalid-join message target `join-error`.
- `handleJoinRoom` now resolves room data via `getRoomByInviteCode`, persists `activeRoom`, transitions to `in-room`, and sends `JOIN_ROOM` with explicit `wsUrl` derived from `API_BASE` host.
- Disconnect behavior now removes only `activeRoom` (keeps token), resets popup state back to lobby, clears invite input/join error, and sends `LEAVE_ROOM` to trigger sidebar teardown.
- Invite link rendering in-room now uses `/join/<inviteCode>` and remains copyable via `copy-invite`.
- Auto-open/hide chain stays wired: background broadcasts `ROOM_JOINED`/`ROOM_LEFT` and content script mounts/unmounts sidebar on those events.

## [2026-03-08] F4 scope fidelity findings
- Implemented feature set is broadly aligned with T1-T12 deliverables and guardrails.
- T13 is only partially implemented: manual invite-code join exists, but no detected auto-join from invite link/context on popup open.
- Required output artifact exists at `extension/.output/chrome-mv3/manifest.json` with MV3 config.
- Forbidden-pattern scans for chat/OAuth/daisyUI/@apply/token-refresh/notifications/history returned no matches in `extension/`.
