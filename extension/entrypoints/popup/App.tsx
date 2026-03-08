import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoom, createToken, getRoomByInviteCode } from "@openparty/api-client";

type View = "login" | "lobby" | "in-room";

type StoredRoom = {
  roomId: string;
  inviteCode: string;
  status: string;
};

const API_BASE = "http://localhost:4000";

function buildSocketEndpoint(apiBase: string): string {
  const parsed = new URL(apiBase);
  const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${parsed.host}/socket`;
}

function normalizeRoom(room: unknown): StoredRoom | null {
  if (!room || typeof room !== "object") {
    return null;
  }

  const payload = room as {
    roomId?: string;
    room_id?: string;
    inviteCode?: string;
    invite_code?: string;
    status?: string;
  };

  const roomId = payload.roomId ?? payload.room_id;
  const inviteCode = payload.inviteCode ?? payload.invite_code;

  if (!roomId || !inviteCode) {
    return null;
  }

  return {
    roomId,
    inviteCode,
    status: payload.status ?? "active"
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function setStorage(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

async function removeStorage(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

type AuthState = {
  token?: string;
  activeRoom?: unknown;
};

type VideoStatusPayload = {
  type?: string;
  detected?: boolean;
  tabId?: number;
};

async function getStoredAuthState(): Promise<AuthState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["token", "activeRoom"], (result: AuthState) => {
      resolve(result);
    });
  });
}

export default function App() {
  const loginFormId = "login-form";
  const loginEmailId = "login-email";
  const loginPasswordId = "login-password";
  const loginSubmitId = "login-submit";
  const registerLinkId = "register-link";
  const loginErrorId = "login-error";
  const videoStatusId = "video-status";
  const startPartyId = "start-party";
  const inviteLinkId = "invite-link";
  const copyInviteId = "copy-invite";
  const joinFormId = "join-form";
  const joinCodeId = "join-code";
  const joinSubmitId = "join-submit";
  const joinErrorId = "join-error";
  const disconnectPartyId = "disconnect-party";

  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<View>("login");
  const [videoDetected, setVideoDetected] = useState(false);
  const [room, setRoom] = useState<StoredRoom | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const activeTabIdRef = useRef<number | null>(null);

  const inviteLink = useMemo(() => {
    if (!room) {
      return "";
    }

    return `${API_BASE}/join/${room.inviteCode}`;
  }, [room]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const stored = await getStoredAuthState();
      if (!mounted) {
        return;
      }

      if (stored.token) {
        setToken(stored.token);
        const normalizedRoom = normalizeRoom(stored.activeRoom);
        if (normalizedRoom) {
          setRoom(normalizedRoom);
          setView("in-room");
        } else {
          setView("lobby");
        }
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (typeof tabId !== "number") {
          return;
        }

        activeTabIdRef.current = tabId;

        chrome.runtime.sendMessage({ type: "GET_VIDEO_STATUS", tabId }, (response: VideoStatusPayload) => {
          if (chrome.runtime.lastError) {
            return;
          }

          if (response?.type === "VIDEO_STATUS") {
            setVideoDetected(Boolean(response.detected));
          }
        });

        chrome.tabs.sendMessage(tabId, { type: "GET_VIDEO_STATUS" }).catch(() => {
        });
      });

      setBooting(false);
    };

    void init();

    const handler = (msg: unknown) => {
      if (!msg || typeof msg !== "object") {
        return;
      }

      const payload = msg as VideoStatusPayload;
      if (payload.type === "VIDEO_STATUS") {
        if (
          typeof payload.tabId === "number" &&
          activeTabIdRef.current !== null &&
          payload.tabId !== activeTabIdRef.current
        ) {
          return;
        }
        setVideoDetected(Boolean(payload.detected));
      }
    };

    chrome.runtime.onMessage.addListener(handler);

    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setJoinError(null);

    try {
      const result = await createToken(API_BASE, email.trim(), password);
      await setStorage({ token: result.token });
      setToken(result.token);
      setView("lobby");
      setPassword("");
    } catch (loginError) {
      setError(getErrorMessage(loginError, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  };

  const handleStartParty = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roomData = await createRoom(API_BASE, token);
      const nextRoom: StoredRoom = {
        roomId: roomData.room_id,
        inviteCode: roomData.invite_code,
        status: roomData.status ?? "active"
      };

      await setStorage({ activeRoom: nextRoom });
      setRoom(nextRoom);
      setView("in-room");
      chrome.runtime.sendMessage({
        type: "JOIN_ROOM",
        roomId: nextRoom.roomId,
        token,
        wsUrl: buildSocketEndpoint(API_BASE)
      });
    } catch (roomError) {
      setError(getErrorMessage(roomError, "Unable to start party."));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    const code = inviteCodeInput.trim();
    if (!code) {
      setJoinError("Enter an invite code to join a party.");
      return;
    }

    setLoading(true);
    setError(null);
    setJoinError(null);

    try {
      const roomData = await getRoomByInviteCode(API_BASE, token, code);
      const nextRoom: StoredRoom = {
        roomId: roomData.room_id,
        inviteCode: roomData.invite_code,
        status: roomData.status ?? "active"
      };

      await setStorage({ activeRoom: nextRoom });
      setRoom(nextRoom);
      setView("in-room");
      chrome.runtime.sendMessage({
        type: "JOIN_ROOM",
        roomId: nextRoom.roomId,
        token,
        wsUrl: buildSocketEndpoint(API_BASE)
      });
    } catch (joinError) {
      setJoinError(getErrorMessage(joinError, "Room not found or invite code invalid"));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      await removeStorage("activeRoom");
      setRoom(null);
      setView("lobby");
      setInviteCodeInput("");
      setJoinError(null);
      chrome.runtime.sendMessage({ type: "LEAVE_ROOM" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setError("Could not copy invite link.");
    }
  };

  if (booting) {
    return (
      <main
        className="w-80 max-h-[500px] bg-[#0f0f11] p-4 text-[#f0f0f0]"
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
      >
        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-[#2a2a35] bg-[#1a1a1f]">
          <div className="flex items-center gap-3 text-sm text-[#c6c6cf]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
            Loading...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="w-80 max-h-[500px] overflow-y-auto bg-[#0f0f11] p-4 text-[#f0f0f0]"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#1a1a1f] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_55%)]" />

        <header className="relative mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#888]">OpenParty</p>
            <h1 className="text-lg font-semibold text-[#f0f0f0]">Watch together. Stay synced. 🎉</h1>
          </div>
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />}
        </header>

        {view === "login" && (
          <section className="relative space-y-3">
            <form id={loginFormId} onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#b3b3bc]" htmlFor={loginEmailId}>
                  Email
                </label>
                <input
                  id={loginEmailId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-[#2a2a35] bg-[#101015] px-3 py-2 text-sm text-[#f0f0f0] outline-none transition focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/40"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#b3b3bc]" htmlFor={loginPasswordId}>
                  Password
                </label>
                <input
                  id={loginPasswordId}
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-[#2a2a35] bg-[#101015] px-3 py-2 text-sm text-[#f0f0f0] outline-none transition focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/40"
                  placeholder="Password"
                />
              </div>

              {error && (
                <div id={loginErrorId} className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef8c8c]">
                  {error}
                </div>
              )}

              <button
                id={loginSubmitId}
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#7c3aed] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#8a49f0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="text-xs text-[#9a9aa6]">
              Don&apos;t have an account?{" "}
              <a
                id={registerLinkId}
                href={`${API_BASE}/users/register`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#b28aff] transition hover:text-[#d0b8ff]"
              >
                Register
              </a>
            </p>
          </section>
        )}

        {view === "lobby" && (
          <section className="relative space-y-3">
            <div id={videoStatusId} className="rounded-lg border border-[#2a2a35] bg-[#13131a] px-3 py-2 text-xs">
              <span className={videoDetected ? "text-[#22c55e]" : "text-[#888]"}>
                {videoDetected ? "Video detected" : "No video detected"}
              </span>
            </div>

            {error && <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef8c8c]">{error}</div>}

            <button
              id={startPartyId}
              type="button"
              onClick={handleStartParty}
              disabled={loading || !videoDetected}
              className="w-full rounded-lg bg-[#7c3aed] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#8a49f0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Starting..." : "Start Party"}
            </button>

            <form id={joinFormId} onSubmit={handleJoinRoom} className="space-y-2 rounded-lg border border-[#2a2a35] bg-[#13131a] p-3">
              <label className="text-xs text-[#b3b3bc]" htmlFor={joinCodeId}>
                Join with invite code
              </label>
              <input
                id={joinCodeId}
                type="text"
                value={inviteCodeInput}
                onChange={(event) => {
                  setInviteCodeInput(event.target.value);
                  if (joinError) {
                    setJoinError(null);
                  }
                }}
                className="w-full rounded-lg border border-[#2a2a35] bg-[#101015] px-3 py-2 text-sm text-[#f0f0f0] outline-none transition focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/40"
                placeholder="e.g. PARTY123"
              />
              <button
                id={joinSubmitId}
                type="submit"
                disabled={loading || !inviteCodeInput.trim()}
                className="w-full rounded-lg border border-[#343442] bg-[#1d1d26] px-3 py-2 text-sm font-medium text-[#f0f0f0] transition hover:border-[#7c3aed]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Party"}
              </button>
              {joinError && <div id={joinErrorId} className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef8c8c]">{joinError}</div>}
            </form>
          </section>
        )}

        {view === "in-room" && room && (
          <section className="relative space-y-3">
            <div id={videoStatusId} className="rounded-lg border border-[#2a2a35] bg-[#13131a] px-3 py-2 text-xs">
              <span className={videoDetected ? "text-[#22c55e]" : "text-[#888]"}>
                {videoDetected ? "Video detected" : "No video detected"}
              </span>
            </div>

            <div className="rounded-lg border border-[#2a2a35] bg-[#13131a] p-3">
              <p className="text-xs text-[#b3b3bc]">Room status</p>
              <p className="text-sm font-medium text-[#f0f0f0]">
                {room.status} <span className="text-[#888]">({room.inviteCode})</span>
              </p>
            </div>

            <input
              id={inviteLinkId}
              type="text"
              readOnly
              value={inviteLink}
              className="w-full rounded-lg border border-[#2a2a35] bg-[#101015] px-3 py-2 text-xs text-[#d4d4dd]"
            />

            <button
              id={copyInviteId}
              type="button"
              onClick={handleCopyInvite}
              className="w-full rounded-lg border border-[#343442] bg-[#1d1d26] px-3 py-2 text-sm font-medium text-[#f0f0f0] transition hover:border-[#7c3aed]/60"
            >
              {copied ? "Copied" : "Copy Invite Link"}
            </button>

            {error && <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef8c8c]">{error}</div>}

            <button
              id={disconnectPartyId}
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full rounded-lg border border-[#ef4444]/30 bg-[#3a1414] px-3 py-2 text-sm font-medium text-[#ffb2b2] transition hover:bg-[#4a1717] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disconnect Party
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
