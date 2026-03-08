# OpenParty Chrome Extension

## TL;DR

> **Quick Summary**: Build a Teleparty-style Chrome extension using WXT + React + Tailwind that authenticates against the OpenParty Phoenix backend, detects `<video>` elements on any website, creates/joins rooms for synchronized playback, and displays a dark-themed activity sidebar with real-time presence and event logs.
> 
> **Deliverables**:
> - WXT-based Chrome extension (Manifest V3) with React + Tailwind
> - Popup UI: login form, "Start Party" button, shareable invite link, disconnect
> - Content script: universal `<video>` detection via MutationObserver
> - Background service worker: WebSocket connection via phoenix.js
> - Injected sidebar: dark-themed activity log with simple/detailed mode toggle
> - Playback sync: host sends play/pause/seek → guests receive and apply
> - Shared API client: extended with createRoom helper
> - Backend fix: `check_origin` config for chrome-extension:// in production
> - Unit tests (Vitest) + E2E tests (Playwright)
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: T1 (backend fix) → T2 (WXT init) → T3 (phoenix.js spike) → T6 (background WSocket) → T9 (playback sync) → T10 (activity log) → T12 (E2E tests) → Final Verification

---

## Context

### Original Request
Build a Teleparty-style Chrome extension for OpenParty. The extension should: authenticate users, detect video elements on streaming sites, create/join synchronized rooms, display a shareable invite link, and show a dark-themed sidebar with activity logs (who connected, who paused/played, with a toggle for detailed events). No chat for now but structure should support it later.

### Interview Summary
**Key Discussions**:
- Build framework: **WXT** — user confirmed for Next.js-like DX, best MV3 support, HMR
- UI stack: **React + Tailwind** — user chose for developer ecosystem support
- Target sites: **Universal** — any page with a `<video>` element
- Invite link: **Auto-open sidebar** when joining via invite link
- Registration: **Web redirect** — extension opens /users/register in new tab, login stays in popup
- Test strategy: **Unit (Vitest) + E2E (Playwright)** — full coverage

**Research Findings**:
- Backend has no `POST /api/register` endpoint — registration via web UI only
- `check_origin` defaults to `true` in production — blocks chrome-extension:// WebSocket connections
- `display_name` is empty for email/password users — need fallback (email prefix)
- Snapshot (on join) and `playback_updated` (broadcast) have different shapes — client must merge diffs
- `shared/api-client` missing `createRoom()` helper
- Room idle timeout is 15 minutes — extension needs graceful handling

### Metis Review
**Identified Gaps** (addressed):
- No registration API → resolved: web redirect from popup
- `check_origin` blocks prod WebSocket → prerequisite backend task (T1)
- phoenix.js in service worker untested → validation spike task (T3)
- Snapshot vs broadcast shape mismatch → client merges diffs into local state
- Missing createRoom in shared client → added to API client task (T4)
- CSS isolation for sidebar → Shadow DOM injection
- display_name empty → email prefix fallback
- Multiple video elements → largest visible heuristic

---

## Work Objectives

### Core Objective
Deliver a Chrome extension that lets users create synchronized video watching parties on any website, with real-time activity logging, matching the Teleparty experience.

### Concrete Deliverables
- `extension/` — Complete WXT project with React + Tailwind, buildable via `npx wxt build`
- `extension/.output/chrome-mv3/` — Built extension loadable in Chrome
- `shared/api-client/src/client.js` — Extended with `createRoom()` helper
- `config/runtime.exs` — Updated with `check_origin` for chrome-extension://
- Unit tests passing via `npx vitest run`
- E2E tests passing via `npx playwright test`

### Definition of Done
- [ ] `npx wxt build` exits 0 and produces loadable Chrome extension
- [ ] Extension loads in Chrome via "Load unpacked" without errors
- [ ] Login flow works (email/password → token saved → popup shows party controls)
- [ ] "Register" link opens web registration page in new tab
- [ ] Video detection works on YouTube, Netflix, and generic HTML5 video pages
- [ ] "Start Party" creates room and shows shareable invite link
- [ ] Invite link copies to clipboard
- [ ] Sidebar appears on the right side of the page after joining/creating room
- [ ] Sidebar shows real-time activity: join/leave, play/pause events
- [ ] Toggle between simple and detailed activity modes
- [ ] Host play/pause/seek syncs to all guests within 2 seconds
- [ ] Guest video position corrected via sync_check
- [ ] Disconnect button leaves room and closes sidebar
- [ ] Dark theme sidebar matches Teleparty aesthetics
- [ ] All unit tests pass (`npx vitest run`)
- [ ] All E2E tests pass (`npx playwright test`)

### Must Have
- Login with email/password via existing POST /api/tokens endpoint
- "Register" link that opens web registration page
- Universal `<video>` element detection (MutationObserver)
- Room creation via POST /api/rooms
- Room joining via invite code (GET /api/rooms/code/:code)
- WebSocket connection via phoenix.js to /socket/websocket
- Playback synchronization (play/pause/seek) — host controls, guests follow
- Dark-themed sidebar with activity log
- Simple mode (connections + play/pause) and detailed mode (all events) toggle
- Shareable invite link with copy button
- Presence tracking (who's in the room)
- CSS isolation via Shadow DOM for sidebar
- Token persistence in chrome.storage.local
- Graceful error handling (invalid credentials, room not found, connection lost)

### Must NOT Have (Guardrails)
- **No chat functionality** — sidebar is activity log only. Structure HTML for future chat, nothing more
- **No OAuth login from extension** — email/password only. OAuth requires complex redirect flows
- **No registration form in extension** — web redirect only
- **No playback controls in sidebar** — host controls video natively, no play/pause buttons in sidebar
- **No multi-browser support** — Chrome only for v1
- **No site-specific video player adapters** — universal `<video>` detection only
- **No token refresh logic** — API tokens don't expire, simple logout to clear
- **No buffering/loading state sync** — only play/pause/seek
- **No browser notifications** — activity log in sidebar is sufficient
- **No room history/persistence** — rooms are ephemeral
- **No Tailwind config file** — Tailwind v4 uses CSS imports, NOT tailwind.config.js
- **No daisyUI or component libraries** — hand-crafted Tailwind components
- **No inline `<script>` tags** — all JS through WXT build pipeline
- **No `@apply` directives** in CSS

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO (new project, setting up from scratch)
- **Automated tests**: YES — Unit (Vitest) + E2E (Playwright)
- **Framework**: Vitest for unit tests, Playwright for E2E browser extension tests
- **Approach**: Tests-after (implementation first, then comprehensive tests)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Extension UI (popup/sidebar)**: Use Playwright — load unpacked extension, interact, screenshot
- **API integration**: Use Bash (curl) — send requests, assert status + response fields
- **Build verification**: Use Bash — `npx wxt build`, check exit code and output directory
- **WebSocket**: Use Bash — test scripts connecting via phoenix.js
- **Content script**: Use Playwright — navigate to video page, verify detection and sidebar injection

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — prerequisites + scaffolding):
├── Task 1: Backend check_origin fix [quick]
├── Task 2: WXT project init + workspace integration [quick]
├── Task 3: phoenix.js service worker compatibility spike [deep]
└── Task 4: Extend shared API client [quick]

Wave 2 (After Wave 1 — core extension modules, MAX PARALLEL):
├── Task 5: Popup UI — auth + party management [visual-engineering]
├── Task 6: Background service worker — WebSocket manager [deep]
└── Task 7: Content script — video detection + message relay [deep]

Wave 3 (After Wave 2 — integration features):
├── Task 8: Sidebar — dark-themed activity log [visual-engineering]
├── Task 9: Playback synchronization — host/guest logic [deep]
└── Task 10: Activity log — presence + event tracking [unspecified-high]

Wave 4 (After Wave 3 — testing + polish):
├── Task 11: Unit tests (Vitest) [unspecified-high]
├── Task 12: E2E tests (Playwright) [unspecified-high]
└── Task 13: Invite link flow + auto-join [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: T1 → T2 → T3 → T6 → T9 → T10 → T12 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | T6 (prod WebSocket) | 1 |
| T2 | — | T5, T6, T7, T8 | 1 |
| T3 | — | T6 | 1 |
| T4 | — | T5, T6 | 1 |
| T5 | T2, T4 | T13 | 2 |
| T6 | T2, T3, T4 | T9, T10 | 2 |
| T7 | T2 | T8, T9 | 2 |
| T8 | T2, T7 | T10, T13 | 3 |
| T9 | T6, T7 | T11, T12 | 3 |
| T10 | T6, T8 | T11, T12 | 3 |
| T11 | T9, T10 | F1-F4 | 4 |
| T12 | T9, T10 | F1-F4 | 4 |
| T13 | T5, T8 | F1-F4 | 4 |
| F1-F4 | T11, T12, T13 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **4** — T1 → `quick`, T2 → `quick`, T3 → `deep`, T4 → `quick`
- **Wave 2**: **3** — T5 → `visual-engineering`, T6 → `deep`, T7 → `deep`
- **Wave 3**: **3** — T8 → `visual-engineering`, T9 → `deep`, T10 → `unspecified-high`
- **Wave 4**: **3** — T11 → `unspecified-high`, T12 → `unspecified-high`, T13 → `unspecified-high`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. Backend: Allow chrome-extension:// WebSocket origins in production

  **What to do**:
  - Edit `config/runtime.exs` inside the `if config_env() == :prod do` block
  - Add `check_origin: ["https://" <> host, ~r/^chrome-extension:\/\//]` to the Endpoint config at line 60-69
  - This goes into the existing `config :open_party, OpenPartyWeb.Endpoint` block that has `url:`, `http:`, and `secret_key_base:`
  - Also add `check_origin: false` to `config/dev.exs` if not already present (it is — verify only)
  - Run `mix test` to confirm no regressions (expect 154 tests, 0 failures)

  **Must NOT do**:
  - Do NOT set `check_origin: false` in production (security risk)
  - Do NOT modify `endpoint.ex` — the socket config stays as `websocket: true`
  - Do NOT touch CORS config

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single config file change, 2-3 lines of Elixir
  - **Skills**: []
    - No special skills needed for a config change

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: T6 (background WebSocket needs this for prod)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `config/runtime.exs:60-69` — Existing prod Endpoint config block where `check_origin` must be added
  - `config/dev.exs` — Should already have `check_origin: false` in the socket config (verify)
  - `lib/open_party_web/endpoint.ex:18-20` — Socket definition (`socket "/socket", OpenPartyWeb.UserSocket, websocket: true`) — do NOT modify, just reference to understand the socket path

  **API/Type References**:
  - Phoenix `check_origin` docs: accepts a list of strings/regexes. `~r/^chrome-extension:\/\//` matches all extension origins

  **External References**:
  - Phoenix Endpoint check_origin config: https://hexdocs.pm/phoenix/Phoenix.Endpoint.html

  **Acceptance Criteria**:
  - [ ] `config/runtime.exs` contains `check_origin:` with both `"https://" <> host` and `~r/^chrome-extension:\/\//`
  - [ ] `mix test` → 154 tests, 0 failures
  - [ ] `mix compile --warnings-as-errors` → exits 0

  **QA Scenarios:**

  ```
  Scenario: check_origin config is correctly added
    Tool: Bash (grep + mix)
    Preconditions: Backend codebase at project root
    Steps:
      1. Run: grep -n 'check_origin' config/runtime.exs
      2. Assert output contains 'chrome-extension'
      3. Run: mix compile --warnings-as-errors
      4. Assert exit code 0
      5. Run: mix test
      6. Assert '154 tests, 0 failures' in output
    Expected Result: Config present, compilation clean, all tests pass
    Failure Indicators: grep returns no matches, compilation warnings, test failures
    Evidence: .sisyphus/evidence/task-1-check-origin-config.txt

  Scenario: Dev config still has check_origin false
    Tool: Bash (grep)
    Preconditions: Backend codebase at project root
    Steps:
      1. Run: grep -n 'check_origin' config/dev.exs
      2. Assert output contains 'false'
    Expected Result: Dev environment allows all origins
    Failure Indicators: No check_origin in dev.exs or set to restrictive value
    Evidence: .sisyphus/evidence/task-1-dev-check-origin.txt
  ```

  **Commit**: YES
  - Message: `fix(backend): allow chrome-extension WebSocket origins in production`
  - Files: `config/runtime.exs`
  - Pre-commit: `mix test`

---

- [ ] 2. WXT Project Init + Workspace Integration

  **What to do**:
  - Remove the existing scaffold files in `extension/` (background.js, popup.html, popup.js, manifest.json, README.md) — keep only `extension/package.json` temporarily
  - Initialize WXT project in the `extension/` directory with React + TypeScript template
  - Run `npx wxt@latest init extension --template react` (or equivalent WXT init command)
  - Configure Tailwind CSS v4 in the project:
    - Install `tailwindcss` and `@tailwindcss/vite` as dev dependencies
    - Add Tailwind v4 CSS imports to the main CSS file: `@import "tailwindcss";`
    - Do NOT create a `tailwind.config.js` — Tailwind v4 uses CSS-based config
  - Update `extension/package.json` to ensure it works as npm workspace member:
    - Verify name is `@openparty/extension` or similar
    - Ensure it can import from `@openparty/api-client` workspace package
  - Configure WXT manifest in `wxt.config.ts`:
    - name: "OpenParty"
    - permissions: ["storage", "activeTab"]
    - host_permissions: ["http://localhost:4000/*", "https://*/*"]
  - Run `npm install` from repo root — verify workspace resolution works
  - Run `npx wxt build` from extension/ — verify build succeeds
  - Verify the output at `extension/.output/chrome-mv3/` contains manifest.json

  **Must NOT do**:
  - Do NOT create `tailwind.config.js` — Tailwind v4 uses CSS imports
  - Do NOT install daisyUI or any component library
  - Do NOT add dependencies beyond WXT + React + Tailwind + TypeScript essentials
  - Do NOT configure content scripts or background scripts yet — just the shell

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Scaffolding task — run CLI commands, configure build tool
  - **Skills**: []
    - WXT init is a CLI command, no special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: T5, T6, T7, T8 (all extension feature tasks need the WXT shell)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `extension/package.json` — Current scaffold package.json, will be replaced by WXT init
  - `package.json` (root) — Workspace config with `"workspaces": ["extension", "shared/*"]`
  - `shared/api-client/package.json` — Workspace peer package for verifying cross-package imports

  **External References**:
  - WXT official docs: https://wxt.dev/guide/installation.html
  - WXT React template: https://wxt.dev/guide/installation.html#react
  - Tailwind CSS v4 install: https://tailwindcss.com/docs/installation/vite

  **Acceptance Criteria**:
  - [ ] `npm install` from repo root exits 0 (workspace resolution works)
  - [ ] `npx wxt build` from `extension/` exits 0
  - [ ] `extension/.output/chrome-mv3/manifest.json` exists and is valid JSON
  - [ ] `extension/.output/chrome-mv3/manifest.json` contains `"manifest_version": 3`
  - [ ] No `tailwind.config.js` file exists anywhere in extension/
  - [ ] `extension/package.json` exists with React, Tailwind, and WXT dependencies
  - [ ] Importing from `@openparty/api-client` resolves (test with a simple import statement in a temp file)

  **QA Scenarios:**

  ```
  Scenario: WXT build produces valid Chrome extension
    Tool: Bash
    Preconditions: npm install completed from repo root
    Steps:
      1. Run: cd extension && npx wxt build
      2. Assert exit code 0
      3. Run: ls extension/.output/chrome-mv3/
      4. Assert manifest.json exists in output
      5. Run: cat extension/.output/chrome-mv3/manifest.json | jq '.manifest_version'
      6. Assert output is 3
    Expected Result: Build succeeds, produces valid MV3 extension
    Failure Indicators: Build error, missing manifest, wrong manifest version
    Evidence: .sisyphus/evidence/task-2-wxt-build.txt

  Scenario: Workspace cross-package imports work
    Tool: Bash
    Preconditions: npm install completed
    Steps:
      1. Create temp file: extension/test-import.ts with `import { createToken } from '@openparty/api-client'`
      2. Run: cd extension && npx tsc --noEmit test-import.ts (or similar resolution check)
      3. Assert import resolves without errors
      4. Delete temp file
    Expected Result: Workspace packages resolve correctly
    Failure Indicators: Module not found error
    Evidence: .sisyphus/evidence/task-2-workspace-imports.txt
  ```

  **Commit**: YES
  - Message: `feat(extension): initialize WXT project with React + Tailwind`
  - Files: `extension/`
  - Pre-commit: `npx wxt build`

---

- [ ] 3. Spike: Validate phoenix.js in Chrome Extension Service Worker

  **What to do**:
  - This is a critical de-risking spike. The entire WebSocket architecture depends on phoenix.js working in a service worker context (no DOM/window)
  - Install `phoenix` npm package in extension/: `npm install phoenix` (workspace-aware)
  - Create a minimal test background script in `extension/entrypoints/background.ts`:
    - Import `Socket` from "phoenix"
    - Attempt to create a Socket instance pointing at `ws://localhost:4000/socket/websocket`
    - Attempt to connect with a test token
    - Log whether connection succeeds or fails
  - Start the Phoenix backend locally (`mix phx.server`)
  - Build extension (`npx wxt build`) and load in Chrome
  - Check service worker console for connection success/failure
  - **If phoenix.js FAILS in service worker**:
    - Document the specific error (e.g., `window is not defined`, `document is not defined`)
    - Test fallback: import phoenix.js in the content script instead, relay messages to background via chrome.runtime
    - Update the architecture decision in this plan accordingly
  - **If phoenix.js SUCCEEDS**: Proceed with background service worker WebSocket architecture as planned

  **Must NOT do**:
  - Do NOT build the full WebSocket manager — this is a connectivity spike only
  - Do NOT import browser-specific globals (window, document) in background script
  - Do NOT leave the spike code in place — clean up or mark as spike clearly

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires running a local server, loading an extension, debugging service worker context
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: T6 (background WebSocket manager architecture depends on this result)
  - **Blocked By**: None (can start immediately, but practically needs T2's WXT shell to build)

  **References**:

  **Pattern References**:
  - `lib/open_party_web/channels/user_socket.ex:7-18` — Socket connect expects `{"token": "<bearer_token>"}` param. Verify by looking at the `connect/3` function
  - `lib/open_party_web/endpoint.ex:18-20` — Socket mounted at `/socket` path with `websocket: true`

  **API/Type References**:
  - Socket connect URL: `ws://localhost:4000/socket/websocket?token=<bearer_token>`
  - Channel join topic: `room:<room_id>` with `{}` payload

  **External References**:
  - phoenix npm package: https://www.npmjs.com/package/phoenix
  - Chrome MV3 service worker limitations: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers

  **Acceptance Criteria**:
  - [ ] phoenix.js imports without error in service worker context
  - [ ] Socket connection to localhost:4000 succeeds from service worker
  - [ ] OR: Fallback architecture documented with working proof-of-concept
  - [ ] Build succeeds with phoenix.js dependency: `npx wxt build` exits 0

  **QA Scenarios:**

  ```
  Scenario: phoenix.js connects from service worker
    Tool: Bash + Playwright
    Preconditions: Phoenix backend running at localhost:4000, test user exists with known credentials
    Steps:
      1. Create test user via: curl -s -X POST http://localhost:4000/api/tokens -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123456"}'
      2. Build extension: cd extension && npx wxt build
      3. Load extension in Chrome (via Playwright or manually)
      4. Open chrome://extensions, find OpenParty, check service worker console
      5. Assert: No errors like 'window is not defined' or 'document is not defined'
      6. Assert: Console shows connection attempt to ws://localhost:4000/socket/websocket
    Expected Result: Socket instance created and connection attempted without DOM errors
    Failure Indicators: ReferenceError for window/document, module import failures
    Evidence: .sisyphus/evidence/task-3-phoenix-service-worker.png

  Scenario: Fallback — phoenix.js in content script (if service worker fails)
    Tool: Bash + manual verification
    Preconditions: Spike showed service worker incompatibility
    Steps:
      1. Move phoenix.js import to content script
      2. Verify Socket connects from content script context
      3. Document message relay pattern: content script ↔ background via chrome.runtime
    Expected Result: Working connection from content script with documented relay pattern
    Failure Indicators: Connection fails in both contexts
    Evidence: .sisyphus/evidence/task-3-phoenix-fallback.md
  ```

  **Commit**: YES
  - Message: `spike(extension): validate phoenix.js in service worker context`
  - Files: `extension/entrypoints/background.ts`
  - Pre-commit: `npx wxt build`

---

- [ ] 4. Extend Shared API Client with createRoom

  **What to do**:
  - Edit `shared/api-client/src/client.js` to add a `createRoom(apiBase, token)` function:
    - `POST ${apiBase}/api/rooms` with `Authorization: Bearer ${token}` header
    - Returns `{ room_id, invite_code, status }` on success
    - Throws on non-200 response (follow existing pattern from `createToken` and `getRoomByInviteCode`)
  - Also add a `getRoomById(apiBase, token, roomId)` function:
    - `GET ${apiBase}/api/rooms/${roomId}` with bearer token
    - Returns room details
  - Follow the exact pattern of existing functions (plain fetch, apiBase parameter, error throwing)
  - Optionally convert to TypeScript (.ts) if WXT project uses TypeScript — but maintain backwards compat

  **Must NOT do**:
  - Do NOT change existing function signatures
  - Do NOT add dependencies (axios, etc.) — plain fetch only
  - Do NOT add retry logic or caching

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 functions following an established pattern in an existing file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: T5 (popup needs createRoom), T6 (background needs API helpers)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `shared/api-client/src/client.js:1-27` — **THE pattern to follow exactly**. `createToken` (POST with JSON body) and `getRoomByInviteCode` (GET with bearer token). New functions must match this style: plain fetch, apiBase parameter, throw on non-ok response, return response.json()

  **API/Type References**:
  - `shared/api-client/src/openapi.d.ts` — Generated TypeScript types for all endpoints including room creation response shape
  - `lib/open_party_web/controllers/room_controller.ex` — Backend implementation of room endpoints for verifying exact response shape

  **External References**:
  - OpenAPI spec at `shared/openapi/openapi.json` — machine-readable API contract

  **Acceptance Criteria**:
  - [ ] `createRoom(apiBase, token)` function exists and follows existing pattern
  - [ ] `getRoomById(apiBase, token, roomId)` function exists and follows existing pattern
  - [ ] Both functions properly set Authorization header
  - [ ] Both functions throw on non-ok response
  - [ ] Existing `createToken` and `getRoomByInviteCode` are unchanged
  - [ ] `npm install` from root still works

  **QA Scenarios:**

  ```
  Scenario: createRoom calls correct endpoint
    Tool: Bash (curl to verify API contract, then code review)
    Preconditions: Phoenix backend running, test user exists
    Steps:
      1. Get token: TOKEN=$(curl -s -X POST http://localhost:4000/api/tokens -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123456"}' | jq -r '.token')
      2. Create room via curl to verify contract: curl -s -X POST http://localhost:4000/api/rooms -H "Authorization: Bearer $TOKEN"
      3. Assert response contains room_id, invite_code, status fields
      4. Read shared/api-client/src/client.js
      5. Assert createRoom function exists with correct fetch URL pattern
      6. Assert it sets Authorization header
    Expected Result: API contract verified, function implementation matches
    Failure Indicators: Missing function, wrong URL, missing auth header
    Evidence: .sisyphus/evidence/task-4-create-room-api.txt

  Scenario: Existing functions unchanged
    Tool: Bash (diff)
    Preconditions: Git history available
    Steps:
      1. Run: git diff HEAD -- shared/api-client/src/client.js
      2. Assert createToken function body is unchanged
      3. Assert getRoomByInviteCode function body is unchanged
      4. Assert only additions (new functions) are present
    Expected Result: No modifications to existing functions
    Failure Indicators: Changes to createToken or getRoomByInviteCode
    Evidence: .sisyphus/evidence/task-4-no-regressions.txt
  ```

  **Commit**: YES
  - Message: `feat(shared): add createRoom and getRoomById helpers to API client`
  - Files: `shared/api-client/src/client.js`
  - Pre-commit: `npm install`

---

- [ ] 5. Popup UI: Login + Register Link + Party Controls

  **What to do**:
  - Build popup React UI in WXT entrypoint (`extension/entrypoints/popup/`)
  - Login form: email + password fields, submit to `createToken(apiBase, email, password)`
  - Persist token in `chrome.storage.local`
  - Add "Don't have an account? Register" link opening `${apiBase}/users/register` in new tab
  - Default `apiBase` to `http://localhost:4000`; keep base URL input optional and low priority
  - After auth, show: video detection status, `Start Party`, invite link field + copy button, `Disconnect`

  **Must NOT do**:
  - No extension-side registration form
  - No OAuth buttons
  - No chat UI in popup

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UX-heavy popup with state transitions and polished styling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for Teleparty-like dark polished popup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: T13
  - **Blocked By**: T2, T4

  **References**:
  - `shared/api-client/src/client.js` - Use `createToken`, `createRoom` helpers from shared package
  - `extension/manifest.json` (generated by WXT) - Popup entrypoint wiring
  - `README.md` API section - `/api/tokens` request/response format

  **Acceptance Criteria**:
  - [ ] Popup has login form with `#login-email`, `#login-password`, `#login-submit`
  - [ ] Successful login stores token in `chrome.storage.local`
  - [ ] Register link opens `${apiBase}/users/register` in a new tab
  - [ ] Authenticated view shows `#start-party`, `#invite-link`, `#disconnect-party`
  - [ ] Invalid credentials render visible error state

  **QA Scenarios:**

  ```
  Scenario: Login success and token persistence
    Tool: Playwright
    Preconditions: Test account exists
    Steps:
      1. Load extension popup and fill `#login-email` with `test@example.com`
      2. Fill `#login-password` with valid password
      3. Click `#login-submit`
      4. Assert `#start-party` is visible
      5. Evaluate chrome.storage.local and assert `token` exists
    Expected Result: Popup transitions to authenticated controls with token saved
    Evidence: .sisyphus/evidence/task-5-login-success.png

  Scenario: Invalid credentials error
    Tool: Playwright
    Preconditions: Popup opened
    Steps:
      1. Fill `#login-email` with `bad@example.com`
      2. Fill `#login-password` with `wrongpass`
      3. Click `#login-submit`
      4. Assert `#login-error` contains "Token request failed"
    Expected Result: Login fails gracefully with clear error text
    Evidence: .sisyphus/evidence/task-5-login-error.png
  ```

  **Commit**: YES
  - Message: `feat(extension): popup auth and party controls`
  - Files: `extension/entrypoints/popup/*`
  - Pre-commit: `npx wxt build`

---

- [ ] 6. Background Service Worker: Socket + Room Session Manager

  **What to do**:
  - Implement background module for Socket lifecycle in `extension/entrypoints/background.ts`
  - Connect to `ws(s)://<api-host>/socket/websocket?token=<token>` using phoenix `Socket`
  - Join `room:<room_id>` channels with `{}` payload
  - Maintain in-memory room session state: roomId, inviteCode, isHost, revision, playbackState
  - Relay messages between popup/content/sidebar via `chrome.runtime.onMessage`
  - Handle reconnect logic and channel rejoin after disconnect

  **Must NOT do**:
  - No DOM operations in service worker
  - No site-specific playback logic in background

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Stateful realtime orchestration across extension contexts
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: T9, T10
  - **Blocked By**: T1, T2, T3, T4

  **References**:
  - `lib/open_party_web/channels/user_socket.ex:7` - token-based socket auth
  - `lib/open_party_web/channels/room_channel.ex:9` - join topic format `room:<room_id>`
  - `lib/open_party_web/channels/room_channel.ex:91` - `request_snapshot` flow

  **Acceptance Criteria**:
  - [ ] Background connects socket with valid token
  - [ ] Channel join succeeds and receives initial `snapshot`
  - [ ] Reconnect attempts happen automatically after transport close
  - [ ] Popup can request current session state from background

  **QA Scenarios:**

  ```
  Scenario: Socket connect + join room
    Tool: Playwright + Bash
    Preconditions: Backend running, token available
    Steps:
      1. Trigger room join from popup
      2. Inspect background logs for `socket connected`
      3. Assert `snapshot` payload received in background
    Expected Result: Room session active in service worker state
    Evidence: .sisyphus/evidence/task-6-socket-join.txt

  Scenario: Network drop reconnect
    Tool: Playwright
    Preconditions: Active room session
    Steps:
      1. Simulate offline mode in browser context
      2. Return online after 5 seconds
      3. Assert background logs show reconnect + rejoin
    Expected Result: Session recovers without manual reconnect
    Evidence: .sisyphus/evidence/task-6-reconnect.txt
  ```

  **Commit**: YES
  - Message: `feat(extension): background websocket room manager`
  - Files: `extension/entrypoints/background.ts`
  - Pre-commit: `npx wxt build`

---

- [ ] 7. Content Script: Universal Video Detection + Event Bridge

  **What to do**:
  - Implement content script for all pages in WXT
  - Detect candidate video using MutationObserver + largest visible `<video>` heuristic
  - Emit video availability status to popup/background
  - For host sessions, listen to native `play`, `pause`, `seeked` and send normalized events with `position_ms`
  - For guest sessions, receive playback commands and apply to detected video element

  **Must NOT do**:
  - No site-specific selectors/adapters
  - No sidebar injection here yet (handled in Task 8)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Event normalization + heuristics + cross-context messaging
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: T8, T9
  - **Blocked By**: T2

  **References**:
  - `lib/open_party_web/channels/room_channel.ex:35-89` - required payload shape for host control events
  - `lib/open_party_web/channels/room_channel.ex:96-121` - sync_check payload keys

  **Acceptance Criteria**:
  - [ ] Content script reports `video_detected` true when visible video exists
  - [ ] Largest visible video heuristic selects stable target across dynamic DOM updates
  - [ ] Host emits normalized events `{position_ms}` on play/pause/seeked
  - [ ] Guest applies incoming sync commands to target video

  **QA Scenarios:**

  ```
  Scenario: Detect video on generic HTML5 page
    Tool: Playwright
    Preconditions: Test page with a single `<video>`
    Steps:
      1. Open page with video
      2. Assert runtime message `video_detected=true` reached popup/background
      3. Assert popup status shows "Video detected"
    Expected Result: Detection pipeline works end-to-end
    Evidence: .sisyphus/evidence/task-7-video-detect.png

  Scenario: No video found state
    Tool: Playwright
    Preconditions: Page with no `<video>`
    Steps:
      1. Open non-video page
      2. Assert popup shows "No video detected"
      3. Assert start-party button disabled
    Expected Result: Graceful empty state
    Evidence: .sisyphus/evidence/task-7-no-video.png
  ```

  **Commit**: YES
  - Message: `feat(extension): content script video detection bridge`
  - Files: `extension/entrypoints/content.ts`
  - Pre-commit: `npx wxt build`

---

- [ ] 8. Sidebar UI: Teleparty-like Dark Activity Panel (Shadow DOM)

  **What to do**:
  - Inject a right-side sidebar container from content script only after room is active
  - Mount React sidebar app inside Shadow DOM to isolate styles
  - Implement dark visual system with subtle gradients, clean typography, compact log list
  - Include top controls: collapse/close, simple vs detailed toggle
  - Keep width <= 360px and avoid covering primary video viewport

  **Must NOT do**:
  - No chat input/reactions
  - No host playback controls in sidebar

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: High-fidelity UI work matching Teleparty visual direction
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for polished, intentional styling and responsive details

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocks**: T10, T13
  - **Blocked By**: T2, T7

  **References**:
  - User-provided Teleparty screenshot - visual benchmark
  - `extension/entrypoints/content.ts` - inject/mount lifecycle hooks

  **Acceptance Criteria**:
  - [ ] Sidebar mounts only when room is active
  - [ ] Sidebar styles are isolated (host page CSS does not override)
  - [ ] `#op-toggle-detail` switches between simple and detailed log modes
  - [ ] Sidebar can close and reopen without stale state bugs

  **QA Scenarios:**

  ```
  Scenario: Sidebar visual and interaction baseline
    Tool: Playwright
    Preconditions: Active room session
    Steps:
      1. Assert `#openparty-sidebar` exists in DOM
      2. Assert computed width <= 360px
      3. Click `#op-toggle-detail` and verify mode indicator changes
      4. Click `#op-sidebar-close` and assert sidebar hidden
    Expected Result: Sidebar renders and behaves as designed
    Evidence: .sisyphus/evidence/task-8-sidebar-ui.png

  Scenario: CSS isolation check
    Tool: Playwright
    Preconditions: Host page with aggressive global styles
    Steps:
      1. Inject host style `* { font-size: 40px !important; }`
      2. Assert sidebar typography remains expected
    Expected Result: Shadow DOM protects sidebar styling
    Evidence: .sisyphus/evidence/task-8-style-isolation.png
  ```

  **Commit**: YES
  - Message: `feat(extension): shadow-dom sidebar with teleparty-like dark theme`
  - Files: `extension/entrypoints/content/*`
  - Pre-commit: `npx wxt build`

---

- [ ] 9. Playback Sync Engine: Host/Guest Roles + Drift Correction

  **What to do**:
  - Build sync coordinator shared by background + content contexts
  - Determine host role from initial `snapshot.host_user_id`
  - Host path: send `play`, `pause`, `seek` with `position_ms`
  - Guest path: apply remote state updates from `playback_updated`
  - Implement periodic `sync_check` (5-10s) using `{ position_ms, last_applied_revision }`
  - Merge `playback_updated` partial payloads into local snapshot state model

  **Must NOT do**:
  - No guest-emitted play/pause/seek
  - No buffering/quality synchronization

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Correctness-critical distributed state behavior
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 10)
  - **Blocks**: T11, T12
  - **Blocked By**: T6, T7

  **References**:
  - `lib/open_party_web/channels/room_channel.ex:35-121` - event APIs and sync_check responses
  - `lib/open_party/rooms/room_server.ex` - snapshot vs playback_updated field differences

  **Acceptance Criteria**:
  - [ ] Host emits valid payloads and receives `{ok, snapshot}` replies
  - [ ] Guest ignores local control sends and only applies remote updates
  - [ ] `sync_check` executes on schedule and handles `in_sync`, `minor_drift`, `corrective_snapshot`
  - [ ] Drift > threshold results in correction within 2s

  **QA Scenarios:**

  ```
  Scenario: Host pause propagates to guest
    Tool: Playwright (2 browser contexts)
    Preconditions: Two extension-enabled contexts joined to same room
    Steps:
      1. Host plays video then pauses at ~15000ms
      2. Assert guest video pauses within 2s
      3. Assert guest currentTime ~15s (+/- 0.5s)
    Expected Result: Deterministic host->guest pause sync
    Evidence: .sisyphus/evidence/task-9-host-pause-sync.mp4

  Scenario: Drift correction via sync_check
    Tool: Playwright
    Preconditions: Guest intentionally offset by +4s
    Steps:
      1. Force guest seek to +4s drift
      2. Wait one sync interval
      3. Assert correction applied and drift < 500ms
    Expected Result: Guest re-aligned automatically
    Evidence: .sisyphus/evidence/task-9-sync-check.txt
  ```

  **Commit**: YES
  - Message: `feat(extension): host-guest playback sync with drift correction`
  - Files: `extension/entrypoints/background/*`, `extension/entrypoints/content/*`
  - Pre-commit: `npx vitest run`

---

- [ ] 10. Activity Log: Presence + Event Feed (Simple/Detailed)

  **What to do**:
  - Parse presence events (`presence_state`, `presence_diff`) to render participant activity
  - Parse playback events to human-readable entries (joined, left, played, paused, seeked)
  - Implement dual log views:
    - Simple: joins + play/pause only
    - Detailed: all events including seek/sync corrections
  - Add display name fallback: if empty, use email prefix or `Anonymous`
  - Cap log history (e.g., 200 entries) to avoid memory growth

  **Must NOT do**:
  - No chat messages
  - No persistent history across sessions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Event modeling + UX data presentation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: T11, T12
  - **Blocked By**: T6, T8

  **References**:
  - `lib/open_party_web/channels/room_channel.ex:25-31` - presence metadata fields
  - `lib/open_party_web/channels/room_channel.ex:35-89` - playback event semantics

  **Acceptance Criteria**:
  - [ ] Simple mode shows joins + play/pause only
  - [ ] Detailed mode includes seek and sync correction events
  - [ ] Empty display_name is replaced with fallback label
  - [ ] Log updates live without sidebar remount

  **QA Scenarios:**

  ```
  Scenario: Presence join/leave entries appear
    Tool: Playwright (2 contexts)
    Preconditions: Active room and sidebar open
    Steps:
      1. Second user joins room
      2. Assert log entry contains `joined the party`
      3. Second user disconnects
      4. Assert log entry contains `left the party`
    Expected Result: Presence lifecycle reflected in log
    Evidence: .sisyphus/evidence/task-10-presence-log.png

  Scenario: Simple mode filters detailed events
    Tool: Playwright
    Preconditions: Event stream includes play, pause, seek
    Steps:
      1. Set mode to simple
      2. Assert seek entries are hidden
      3. Set mode to detailed
      4. Assert seek entries are visible
    Expected Result: Mode filter works deterministically
    Evidence: .sisyphus/evidence/task-10-mode-toggle.png
  ```

  **Commit**: YES
  - Message: `feat(extension): realtime presence and event activity log`
  - Files: `extension/entrypoints/content/*`
  - Pre-commit: `npx vitest run`

---

- [ ] 11. Unit Test Suite (Vitest): API, Sync, and Event Logic

  **What to do**:
  - Set up Vitest config for extension package
  - Add unit tests for shared logic modules:
    - API client wrappers (success + error cases)
    - Video selection heuristic (largest visible video)
    - Event normalization/parsing (simple vs detailed)
    - Sync state reducer (snapshot merge + playback_updated merge)
  - Add mocks for `chrome.*` APIs and Socket message envelopes

  **Must NOT do**:
  - No brittle tests against raw rendered HTML strings
  - No network-dependent unit tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Broad non-trivial test design across multiple modules
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 13)
  - **Blocks**: F1-F4
  - **Blocked By**: T9, T10

  **References**:
  - `shared/api-client/src/client.js` - API helper behavior to validate
  - `extension/entrypoints/*` - sync/event modules under test

  **Acceptance Criteria**:
  - [ ] `npx vitest run` exits 0
  - [ ] Tests include happy + failure cases for all critical modules
  - [ ] Coverage includes sync merge behavior and mode filtering

  **QA Scenarios:**

  ```
  Scenario: Unit suite passes in CI mode
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: cd extension && npx vitest run
      2. Assert exit code 0
      3. Assert no skipped critical tests
    Expected Result: Stable deterministic unit suite
    Evidence: .sisyphus/evidence/task-11-vitest.txt

  Scenario: Error-path tests validate thrown API errors
    Tool: Bash
    Preconditions: Unit tests include API error mocks
    Steps:
      1. Run targeted tests for api-client module
      2. Assert expectations include "throws on non-ok response"
    Expected Result: Error handling contract enforced
    Evidence: .sisyphus/evidence/task-11-api-errors.txt
  ```

  **Commit**: YES
  - Message: `test(extension): add vitest coverage for sync and api logic`
  - Files: `extension/tests/unit/*`
  - Pre-commit: `npx vitest run`

---

- [ ] 12. E2E Extension Tests (Playwright): Popup + Sidebar + Sync Flow

  **What to do**:
  - Configure Playwright to load unpacked WXT output extension
  - Create E2E suites for:
    - Popup login success/failure
    - Start party + invite link copy
    - Sidebar injection + mode toggle
    - Two-context sync behavior (host + guest)
    - Error states (invalid token, room_not_found, no video)
  - Capture screenshots and traces to `.sisyphus/evidence/`

  **Must NOT do**:
  - No tests that require manual clicking outside Playwright
  - No flaky fixed `sleep` timing; use explicit wait conditions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-context browser automation and extension loading complexity
  - **Skills**: [`playwright`]
    - `playwright`: Required for extension E2E automation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 13)
  - **Blocks**: F1-F4
  - **Blocked By**: T9, T10

  **References**:
  - Playwright extension testing docs
  - `extension/.output/chrome-mv3/` - built artifact to load

  **Acceptance Criteria**:
  - [ ] `npx playwright test` exits 0
  - [ ] Tests cover at least one full host+guest sync scenario
  - [ ] Evidence artifacts (screenshots/videos) are saved for each suite

  **QA Scenarios:**

  ```
  Scenario: Full happy path (login -> start party -> sidebar -> sync)
    Tool: Playwright
    Preconditions: Backend running and test users seeded
    Steps:
      1. Launch two browser contexts with extension loaded
      2. Host logs in and starts party on a video page
      3. Guest joins via invite link/code
      4. Host pauses at 25s
      5. Assert guest pauses near 25s
    Expected Result: End-to-end sync behavior validated
    Evidence: .sisyphus/evidence/task-12-e2e-happy.mp4

  Scenario: Room expired error handling
    Tool: Playwright
    Preconditions: Use invalid/expired invite
    Steps:
      1. Attempt join with expired invite code
      2. Assert UI shows `room_not_found` error state
    Expected Result: Graceful failure with actionable message
    Evidence: .sisyphus/evidence/task-12-room-expired.png
  ```

  **Commit**: YES
  - Message: `test(extension): add playwright e2e suites for popup and sync`
  - Files: `extension/tests/e2e/*`
  - Pre-commit: `npx playwright test`

---

- [ ] 13. Invite Flow Completion: Auto-Join + Sidebar Auto-Open

  **What to do**:
  - Implement invite code/link handling in popup state
  - If user opens extension with invite context, resolve room by invite code and join automatically
  - After successful join, send content-script message to auto-open sidebar
  - Ensure deep-link path works even after popup close/reopen (session persisted in background)
  - Add disconnect behavior that clears active room session but keeps auth token

  **Must NOT do**:
  - No auto-join without explicit invite context
  - No token removal on disconnect (logout handles token removal)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-context orchestration and UX state recovery
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12)
  - **Blocks**: F1-F4
  - **Blocked By**: T5, T8

  **References**:
  - `shared/api-client/src/client.js` - invite code lookup helper
  - `lib/open_party_web/controllers/room_controller.ex` - `GET /api/rooms/code/:invite_code`

  **Acceptance Criteria**:
  - [ ] Join via invite auto-opens sidebar
  - [ ] Invalid invite shows explicit error
  - [ ] Disconnect exits room and hides sidebar while keeping token

  **QA Scenarios:**

  ```
  Scenario: Invite join auto-opens sidebar
    Tool: Playwright
    Preconditions: Existing active room with valid invite code
    Steps:
      1. Open guest popup and submit invite code
      2. Assert room join succeeds
      3. Assert `#openparty-sidebar` becomes visible automatically
    Expected Result: Seamless Teleparty-like join experience
    Evidence: .sisyphus/evidence/task-13-invite-autoopen.png

  Scenario: Disconnect preserves auth token
    Tool: Playwright
    Preconditions: Joined room
    Steps:
      1. Click `#disconnect-party`
      2. Assert sidebar hidden and no active room
      3. Check chrome.storage.local still has `token`
    Expected Result: User remains logged in, only room session ends
    Evidence: .sisyphus/evidence/task-13-disconnect-token.png
  ```

  **Commit**: YES
  - Message: `feat(extension): invite auto-join with sidebar auto-open`
  - Files: `extension/entrypoints/popup/*`, `extension/entrypoints/content/*`
  - Pre-commit: `npx playwright test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, load extension, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npx wxt build` + `npx vitest run`. Review all extension files for: `any` type assertions, empty catches, console.log in production code, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify TypeScript strict mode. Check bundle size is reasonable.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Load extension in Chrome via Playwright. Test full flow: login → detect video → start party → copy invite link → verify sidebar appears → verify activity log entries → disconnect. Test error cases: invalid credentials, no video on page, room expired. Save screenshots to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual implementation files. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no chat, no OAuth, no site-specific adapters, no playback controls in sidebar, no tailwind.config.js. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **T1**: `fix(backend): allow chrome-extension WebSocket origins in production` — `config/runtime.exs`
- **T2**: `feat(extension): initialize WXT project with React + Tailwind` — `extension/`
- **T3**: `spike(extension): validate phoenix.js in service worker context` — `extension/`
- **T4**: `feat(shared): add createRoom helper to API client` — `shared/api-client/`
- **T5**: `feat(extension): popup UI with login and party management` — `extension/`
- **T6**: `feat(extension): background WebSocket manager with phoenix.js` — `extension/`
- **T7**: `feat(extension): content script with video detection` — `extension/`
- **T8**: `feat(extension): dark-themed activity sidebar with Shadow DOM` — `extension/`
- **T9**: `feat(extension): playback synchronization (host/guest)` — `extension/`
- **T10**: `feat(extension): activity log with presence tracking` — `extension/`
- **T11**: `test(extension): unit tests with Vitest` — `extension/`
- **T12**: `test(extension): E2E tests with Playwright` — `extension/`
- **T13**: `feat(extension): invite link flow with auto-join` — `extension/`

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
npx wxt build  # Expected: exit 0, extension/.output/chrome-mv3/ exists

# Unit tests pass
npx vitest run  # Expected: all tests pass, 0 failures

# E2E tests pass
npx playwright test  # Expected: all tests pass

# Backend tests still pass (no regressions from T1)
mix test  # Expected: 154 tests, 0 failures

# Extension loads in Chrome without errors
# (verified via Playwright E2E test)
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All unit tests pass
- [x] All E2E tests pass
- [x] Backend tests still pass (154 tests, 0 failures)
- [x] Extension builds cleanly with `npx wxt build`
- [x] Extension loads in Chrome via "Load unpacked"
- [ ] Dark theme sidebar matches Teleparty aesthetic
