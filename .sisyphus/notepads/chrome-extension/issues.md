# Chrome Extension Plan — Issues

## Known Risks
- phoenix.js in service worker: may reference window/document (needs T3 spike)
- snapshot vs playback_updated have different shapes — client must merge diffs
- display_name empty for email/password users — need fallback (email prefix)
- Room idle timeout 15 minutes — need graceful handling

## [2026-03-08] Scope fidelity issues (F4)
- T13 mismatch: no invite-context auto-join detection found in `extension/entrypoints/popup/App.tsx`; only manual join via `#join-form`.
- Unplanned source files detected relative to provided planned-file list:
  - `extension/entrypoints/popup/index.html`
  - `extension/types/api-client.d.ts`
  - `extension/types/background-env.d.ts`
  - `extension/types/content-env.d.ts`
  - `extension/types/playwright-test.d.ts`
  - `extension/types/style-env.d.ts`
  - `extension/tests/unit/setup.ts`
  - `extension/tests/e2e/helpers.ts`
