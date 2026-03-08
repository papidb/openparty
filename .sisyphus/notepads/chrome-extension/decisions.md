# Chrome Extension Plan — Decisions

## Architecture Decisions
- **WebSocket location**: Background service worker (needs spike T3 to validate)
- **CSS isolation**: Shadow DOM for sidebar
- **State persistence**: chrome.storage.local for token, in-memory for room session
- **Video selection**: Largest visible heuristic via MutationObserver
- **Registration**: Web redirect (no form in extension)
- **No chat**: Sidebar is activity log only

## Tech Stack Decisions
- WXT framework (Next.js-like DX, best MV3 support)
- React + TypeScript
- Tailwind CSS v4 (CSS import style, NO tailwind.config.js)
- phoenix npm package for WebSocket
- Vitest for unit tests, Playwright for E2E

## [2026-03-08] F4 review decisions
- Fidelity verdict should be REJECT when any task-level requirement is incomplete, even if guardrail contamination is clean.
- Track unplanned implementation artifacts separately from forbidden-feature contamination to avoid conflating scope creep classes.
