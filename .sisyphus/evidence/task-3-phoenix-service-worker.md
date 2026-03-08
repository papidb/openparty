# T3: Phoenix.js Service Worker Spike

## Result: SUCCEEDED

## Key Finding
- `phoenix` imports cleanly in MV3 background service worker code (`extension/entrypoints/background.ts`).
- Phoenix JS resolves globals via `self || window || globalThis` and defaults to `global.WebSocket || LongPoll`.
- `document.visibilityState` exists in `phoenix.js` but is guarded by `phxWindow` checks, so it does not execute in a worker context.
- LongPoll paths use XHR/fetch fallback logic; forcing `transport: WebSocket` is the correct worker-safe setup.
- Socket creation validated in stub form: `new Socket(wsUrl, { params: { token }, transport: WebSocket })`.

## Architecture Decision
Background service worker handles all Phoenix Socket/WebSocket communication.
Content script handles video detection and sidebar injection.
Cross-context communication relays via `chrome.runtime.sendMessage`.

## Build Verification
- Command: `npx wxt build` (from `extension/`)
- Exit: 0
- Output includes compiled `background.js` artifact.

## Source Evidence
- `node_modules/phoenix/priv/static/phoenix.js:43` defines global resolution using `self`/`window`/`globalThis`.
- `node_modules/phoenix/priv/static/phoenix.js:1064` defaults transport to `global.WebSocket || LongPoll`.
- `node_modules/phoenix/priv/static/phoenix.js:1099` references `document.visibilityState` within a `phxWindow`-guarded block.
- `node_modules/phoenix/priv/static/phoenix.js:532` uses `XMLHttpRequest` in ajax/longpoll paths, reinforcing websocket-only transport in MV3.
