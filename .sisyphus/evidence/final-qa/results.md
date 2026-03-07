

# Final QA Run - 2026-03-07T20:16:47Z

## Verdict
- VERDICT: **APPROVE**
- Required outcomes: 11 passed / 0 failed
- HTTP scenarios: 8 passed / 0 failed
- WebSocket checks: 18 passed / 0 failed

## Expected Outcome Checklist
- [x] Server starts cleanly (PASS)
- [x] GET /api/health returns {"status":"ok"} (PASS)
- [x] POST /api/tokens valid returns bearer token (PASS)
- [x] POST /api/rooms returns room with invite_code (PASS)
- [x] GET /api/rooms/:id returns room details (PASS)
- [x] GET /api/rooms/code/:invite_code returns room (PASS)
- [x] WebSocket channel join works with auth token (PASS)
- [x] play/pause/seek broadcast playback_updated (PASS)
- [x] Non-host play command returns forbidden (PASS)
- [x] sync_check returns in_sync and stale-revision corrective_snapshot (PASS)
- [x] request_snapshot returns current state (PASS)

## Captured Variables
- TOKEN: Mm3Pt3so4s63Uv8Xgyy3xsFzQsmn0nuINp_s3gPYiLo
- ROOM_ID: 8b10c274-919d-447a-a4e1-65cd3ef1a50e
- INVITE_CODE: MF2HHF

## Raw HTTP Capture

```
SCENARIO 1: GET /api/health
HTTP/1.1 200 OK
date: Sat, 07 Mar 2026 20:11:46 GMT
content-length: 15
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK00mNtaQKBEAAADm

{"status":"ok"}

SCENARIO 2: POST /api/tokens valid
HTTP/1.1 200 OK
date: Sat, 07 Mar 2026 20:11:47 GMT
content-length: 55
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK1jNIFuixrwAABEC

{"token":"zWJ-GPTpGEIaHNk90GKpIfvH5knYf_qwxjOCApQdBU4"}

SCENARIO 3: POST /api/tokens wrong password
HTTP/1.1 401 Unauthorized
date: Sat, 07 Mar 2026 20:11:48 GMT
content-length: 37
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK48N6pWl3rIAAAJF

{"error":"Invalid email or password"}

SCENARIO 4: POST /api/rooms with token
HTTP/1.1 201 Created
date: Sat, 07 Mar 2026 20:11:48 GMT
content-length: 104
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK8xNG_V4uO4AAAKB

{"status":"active","title":null,"invite_code":"MXEH65","room_id":"71fe9a4e-b5cb-4a2c-9ec4-aded90a4a359"}

SCENARIO 5: GET /api/rooms/:id with token
HTTP/1.1 200 OK
date: Sat, 07 Mar 2026 20:11:48 GMT
content-length: 104
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK9gxLr4MOeEAAAEG

{"status":"active","title":null,"invite_code":"MF2HHF","room_id":"8b10c274-919d-447a-a4e1-65cd3ef1a50e"}

SCENARIO 6: GET /api/rooms/code/:invite_code with token
HTTP/1.1 200 OK
date: Sat, 07 Mar 2026 20:11:48 GMT
content-length: 104
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK-OW7haZntMAAALB

{"status":"active","title":null,"invite_code":"MF2HHF","room_id":"8b10c274-919d-447a-a4e1-65cd3ef1a50e"}

SCENARIO 7: POST /api/rooms no token
HTTP/1.1 401 Unauthorized
date: Sat, 07 Mar 2026 20:11:49 GMT
content-length: 0
vary: accept-encoding
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoK-4ro58VQiEAAALF



SCENARIO 8: GET /api/rooms/nonexistent with token
HTTP/1.1 404 Not Found
date: Sat, 07 Mar 2026 20:11:49 GMT
content-length: 26
vary: accept-encoding
content-type: application/json; charset=utf-8
cache-control: max-age=0, private, must-revalidate
x-request-id: GJqoLABuPLzPuycAAANF

{"error":"Room not found"}

CAPTURED_VARS
TOKEN=Mm3Pt3so4s63Uv8Xgyy3xsFzQsmn0nuINp_s3gPYiLo
ROOM_ID=8b10c274-919d-447a-a4e1-65cd3ef1a50e
INVITE_CODE=MF2HHF

```

## Raw WebSocket Capture

```
{
  "passed": 18,
  "failed": 0,
  "checks": [
    {
      "name": "host token issued",
      "ok": true,
      "details": {
        "status": 200,
        "json": {
          "token": "uoZLDKHk-Y-ZIGvZRCUYpk00xqnuA2Ohh4LGBFWFwUc"
        },
        "text": "{\"token\":\"uoZLDKHk-Y-ZIGvZRCUYpk00xqnuA2Ohh4LGBFWFwUc\"}"
      }
    },
    {
      "name": "guest token issued",
      "ok": true,
      "details": {
        "status": 200,
        "json": {
          "token": "KbLkEHnbLJ4jSUAPLogJJGOF-OXdmTwL39TB2vOfxPo"
        },
        "text": "{\"token\":\"KbLkEHnbLJ4jSUAPLogJJGOF-OXdmTwL39TB2vOfxPo\"}"
      }
    },
    {
      "name": "room created for ws tests",
      "ok": true,
      "details": {
        "status": 201,
        "json": {
          "status": "active",
          "title": null,
          "invite_code": "4T8MQ8",
          "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d"
        },
        "text": "{\"status\":\"active\",\"title\":null,\"invite_code\":\"4T8MQ8\",\"room_id\":\"383ce238-0440-4e7a-96c9-0d21c705568d\"}"
      }
    },
    {
      "name": "host join with auth token",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "1",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {}
        }
      }
    },
    {
      "name": "guest join with auth token",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "1",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {}
        }
      }
    },
    {
      "name": "host play reply ok",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "2",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "revision": 1,
            "host_user_id": "70d8f848-49a2-470d-828b-a2b5f40e47d5",
            "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d",
            "playback_state": "playing",
            "base_position_ms": 1000,
            "playback_rate": 1,
            "media_id": "video-123"
          }
        }
      }
    },
    {
      "name": "playback_updated broadcast on play (host)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 1,
          "playback_state": "playing",
          "base_position_ms": 1000,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "playback_updated broadcast on play (guest)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 1,
          "playback_state": "playing",
          "base_position_ms": 1000,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "host pause reply ok",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "3",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "revision": 2,
            "host_user_id": "70d8f848-49a2-470d-828b-a2b5f40e47d5",
            "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d",
            "playback_state": "paused",
            "base_position_ms": 1200,
            "playback_rate": 1,
            "media_id": "video-123"
          }
        }
      }
    },
    {
      "name": "playback_updated broadcast on pause (host)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 2,
          "playback_state": "paused",
          "base_position_ms": 1200,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "playback_updated broadcast on pause (guest)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 2,
          "playback_state": "paused",
          "base_position_ms": 1200,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "host seek reply ok",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "4",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "revision": 3,
            "host_user_id": "70d8f848-49a2-470d-828b-a2b5f40e47d5",
            "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d",
            "playback_state": "paused",
            "base_position_ms": 1500,
            "playback_rate": 1,
            "media_id": "video-123"
          }
        }
      }
    },
    {
      "name": "playback_updated broadcast on seek (host)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 3,
          "playback_state": "paused",
          "base_position_ms": 1500,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "playback_updated broadcast on seek (guest)",
      "ok": true,
      "details": {
        "joinRef": null,
        "ref": null,
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "playback_updated",
        "payload": {
          "revision": 3,
          "playback_state": "paused",
          "base_position_ms": 1500,
          "changed_by": "70d8f848-49a2-470d-828b-a2b5f40e47d5"
        }
      }
    },
    {
      "name": "non-host play forbidden",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "2",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "error",
          "response": {
            "code": "forbidden",
            "message": "Only the host can control playback"
          }
        }
      }
    },
    {
      "name": "sync_check in_sync",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "3",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "status": "in_sync"
          }
        }
      }
    },
    {
      "name": "sync_check stale revision corrective_snapshot",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "4",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "corrective_snapshot": {
              "revision": 3,
              "host_user_id": "70d8f848-49a2-470d-828b-a2b5f40e47d5",
              "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d",
              "playback_state": "paused",
              "base_position_ms": 1500,
              "playback_rate": 1,
              "media_id": "video-123"
            }
          }
        }
      }
    },
    {
      "name": "request_snapshot returns current state",
      "ok": true,
      "details": {
        "joinRef": "1",
        "ref": "5",
        "topic": "room:383ce238-0440-4e7a-96c9-0d21c705568d",
        "event": "phx_reply",
        "payload": {
          "status": "ok",
          "response": {
            "revision": 3,
            "host_user_id": "70d8f848-49a2-470d-828b-a2b5f40e47d5",
            "room_id": "383ce238-0440-4e7a-96c9-0d21c705568d",
            "playback_state": "paused",
            "base_position_ms": 1500,
            "playback_rate": 1,
            "media_id": "video-123"
          }
        }
      }
    }
  ]
}

```
