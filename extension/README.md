# OpenParty Chrome Extension (Scaffold)

This folder is a Manifest V3 scaffold for the future OpenParty browser extension.

## Load locally

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `extension/` directory

## Stored config keys

- `apiBase` (default `http://localhost:4000`)
- `inviteCode`

## Room socket join params (from backend contract)

- Socket connect params: `{ "token": "<bearer_token>" }`
- Topic: `room:<room_id>`
- Join payload: `{}`
