import { Channel, Socket } from "phoenix";

type PlaybackStatus = "playing" | "paused";
type HostEventType = "play" | "pause" | "seek";

interface PlaybackState {
  status: PlaybackStatus;
  positionMs: number;
  revision: number;
  hostUserId: string;
}

interface Participant {
  userId: string;
  displayName: string;
  isHost: boolean;
}

interface SessionState {
  roomId: string;
  inviteCode: string;
  isHost: boolean;
  token: string;
  wsUrl: string;
  playbackState: PlaybackState | null;
  participants: Participant[];
  revision: number;
}

interface JoinRoomMessage {
  type: "JOIN_ROOM";
  roomId: string;
  token: string;
  wsUrl?: string;
}

interface LeaveRoomMessage {
  type: "LEAVE_ROOM";
}

interface HostEventMessage {
  type: "HOST_EVENT";
  event: HostEventType;
  positionMs: number;
}

interface SyncCheckMessage {
  type: "SYNC_CHECK";
  positionMs: number;
  lastRevision: number;
}

interface GetSessionStateMessage {
  type: "GET_SESSION_STATE";
}

type InboundMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | HostEventMessage
  | SyncCheckMessage
  | GetSessionStateMessage;

interface SnapshotPayload {
  invite_code?: string;
  playback_state?: PlaybackStatus;
  base_position_ms?: number;
  revision?: number;
  host_user_id?: string;
  is_host?: boolean;
}

interface PlaybackUpdatedPayload {
  playback_state?: PlaybackStatus;
  base_position_ms?: number;
  revision?: number;
  host_user_id?: string;
}

interface CorrectiveSnapshotPayload {
  playback_state?: PlaybackStatus;
  base_position_ms?: number;
  revision?: number;
  host_user_id?: string;
}

interface SyncCheckReply {
  status?: "in_sync" | "minor_drift";
  drift_ms?: number;
  corrective_snapshot?: CorrectiveSnapshotPayload;
}

type PresenceEntry =
  | {
      metas?: Array<Record<string, unknown>>;
    }
  | Array<Record<string, unknown>>;

interface PresenceDiffPayload {
  joins?: Record<string, PresenceEntry>;
  leaves?: Record<string, PresenceEntry>;
}

const DEFAULT_WS_URL = "ws://localhost:4000/socket/websocket";

let socket: Socket | null = null;
let channel: Channel | null = null;
let session: SessionState | null = null;

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeParticipant(meta: Record<string, unknown>): Participant {
  const userId = asString(meta.user_id, asString(meta.id, ""));
  const displayFromEmail = asString(meta.email).split("@")[0] || "Anonymous";

  return {
    userId,
    displayName: asString(meta.display_name, displayFromEmail),
    isHost: false
  };
}

function extractPresenceMetas(entry: PresenceEntry | undefined): Array<Record<string, unknown>> {
  if (!entry) {
    return [];
  }

  if (Array.isArray(entry)) {
    return entry;
  }

  if (Array.isArray(entry.metas)) {
    return entry.metas;
  }

  return [];
}

function applyHostFlags(participants: Participant[]): Participant[] {
  if (!session?.playbackState?.hostUserId) {
    return participants;
  }

  return participants.map((participant) => ({
    ...participant,
    isHost: participant.userId === session?.playbackState?.hostUserId
  }));
}

function safeRuntimeBroadcast(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
  });
}

function safeTabBroadcast(message: unknown): void {
  chrome.tabs.query({}, (tabs: Array<{ id?: number }>) => {
    for (const tab of tabs) {
      if (!tab.id) {
        continue;
      }

      chrome.tabs.sendMessage(tab.id, message).catch(() => {
      });
    }
  });
}

function broadcastToAll(message: unknown): void {
  safeRuntimeBroadcast(message);
  safeTabBroadcast(message);
}

function disconnectCurrentSession(): void {
  if (channel) {
    channel.leave();
    channel = null;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  session = null;
}

function applySnapshot(roomId: string, token: string, wsUrl: string, payload: SnapshotPayload): void {
  const revision = asNumber(payload.revision, 0);
  const playbackState: PlaybackState = {
    status: payload.playback_state === "playing" ? "playing" : "paused",
    positionMs: asNumber(payload.base_position_ms, 0),
    revision,
    hostUserId: asString(payload.host_user_id)
  };

  session = {
    roomId,
    inviteCode: asString(payload.invite_code),
    isHost: Boolean(payload.is_host),
    token,
    wsUrl,
    playbackState,
    participants: session?.participants ?? [],
    revision
  };

  session.participants = applyHostFlags(session.participants);

  broadcastToAll({
    type: "ROOM_JOINED",
    roomId: session.roomId,
    inviteCode: session.inviteCode,
    isHost: session.isHost,
    snapshot: payload
  });

  broadcastToAll({
    type: "PLAYBACK_UPDATE",
    state: session.playbackState
  });
}

export function connectSocket(token: string, wsUrl: string): Socket {
  return new Socket(wsUrl, {
    params: { token },
    transport: WebSocket
  });
}

function connectToRoom(roomId: string, token: string, wsUrl: string): void {
  disconnectCurrentSession();

  socket = connectSocket(token, wsUrl);

  socket.onError((error) => {
    console.error("[OpenParty] Socket error:", error);
  });

  socket.connect();

  channel = socket.channel(`room:${roomId}`, {});

  socket.onOpen(() => {
    if (channel && channel.state !== "joined" && channel.state !== "joining") {
      channel.join();
    }
  });

  channel
    .join()
    .receive("ok", (joinPayload: SnapshotPayload) => {
      if (joinPayload && typeof joinPayload === "object" && joinPayload.revision !== undefined) {
        applySnapshot(roomId, token, wsUrl, joinPayload);
      } else {
        session = {
          roomId,
          inviteCode: "",
          isHost: false,
          token,
          wsUrl,
          playbackState: null,
          participants: [],
          revision: 0
        };
      }
    })
    .receive("error", (reason: unknown) => {
      console.error("[OpenParty] Channel join error:", reason);
    });

  channel.on("snapshot", (payload: SnapshotPayload) => {
    applySnapshot(roomId, token, wsUrl, payload);
  });

  channel.on("playback_updated", (payload: PlaybackUpdatedPayload) => {
    if (!session) {
      return;
    }

    const revision = asNumber(payload.revision, session.revision);
    const hostUserId = asString(payload.host_user_id, session.playbackState?.hostUserId ?? "");

    session.revision = revision;

    if (!session.playbackState) {
      session.playbackState = {
        status: payload.playback_state === "playing" ? "playing" : "paused",
        positionMs: asNumber(payload.base_position_ms, 0),
        revision,
        hostUserId
      };
    } else {
      session.playbackState = {
        ...session.playbackState,
        status: payload.playback_state ?? session.playbackState.status,
        positionMs: asNumber(payload.base_position_ms, session.playbackState.positionMs),
        revision,
        hostUserId
      };
    }

    session.participants = applyHostFlags(session.participants);

    broadcastToAll({
      type: "PLAYBACK_UPDATE",
      state: session.playbackState
    });
  });

  channel.on("presence_state", (state: Record<string, PresenceEntry>) => {
    const participants = Object.values(state)
      .flatMap((entry) => extractPresenceMetas(entry))
      .map(normalizeParticipant)
      .filter((participant) => participant.userId.length > 0);

    if (session) {
      session.participants = applyHostFlags(participants);
    }

    broadcastToAll({
      type: "PRESENCE_UPDATE",
      participants: session?.participants ?? applyHostFlags(participants)
    });
  });

  channel.on("presence_diff", (diff: PresenceDiffPayload) => {
    const joined = Object.values(diff.joins ?? {})
      .flatMap((entry) => extractPresenceMetas(entry))
      .map(normalizeParticipant)
      .filter((participant) => participant.userId.length > 0);

    const leaveIds = new Set(
      Object.values(diff.leaves ?? {})
        .flatMap((entry) => extractPresenceMetas(entry))
        .map((meta) => asString(meta.user_id, asString(meta.id, "")))
        .filter((id) => id.length > 0)
    );

    if (session) {
      const withoutLeft = session.participants.filter((participant) => !leaveIds.has(participant.userId));
      const deduped = new Map<string, Participant>();

      for (const participant of withoutLeft) {
        deduped.set(participant.userId, participant);
      }

      for (const participant of joined) {
        deduped.set(participant.userId, participant);
      }

      session.participants = applyHostFlags(Array.from(deduped.values()));
    }

    broadcastToAll({
      type: "PRESENCE_UPDATE",
      participants: session?.participants ?? []
    });
  });
}

function messageHandler(
  message: InboundMessage,
  _sender: unknown,
  sendResponse: (response?: unknown) => void
): boolean {
  switch (message.type) {
    case "JOIN_ROOM": {
      connectToRoom(message.roomId, message.token, message.wsUrl ?? DEFAULT_WS_URL);
      sendResponse({ ok: true });
      return false;
    }

    case "LEAVE_ROOM": {
      disconnectCurrentSession();
      broadcastToAll({ type: "ROOM_LEFT" });
      sendResponse({ ok: true });
      return false;
    }

    case "HOST_EVENT": {
      if (!channel) {
        sendResponse({ error: "not_connected" });
        return false;
      }

      channel
        .push(message.event, { position_ms: message.positionMs })
        .receive("ok", (reply: unknown) => {
          sendResponse({ ok: true, reply });
        })
        .receive("error", (reason: unknown) => {
          sendResponse({ error: "push_failed", reason });
        });

      return true;
    }

    case "SYNC_CHECK": {
      if (!channel) {
        sendResponse({ error: "not_connected" });
        return false;
      }

      channel
        .push("sync_check", {
          position_ms: message.positionMs,
          last_applied_revision: message.lastRevision
        })
        .receive("ok", (reply: SyncCheckReply) => {
          if (reply.corrective_snapshot) {
            broadcastToAll({
              type: "CORRECTIVE_SNAPSHOT",
              snapshot: reply.corrective_snapshot
            });
          } else if (reply.status === "minor_drift") {
            broadcastToAll({
              type: "MINOR_DRIFT",
              driftMs: asNumber(reply.drift_ms, 0)
            });
          }

          sendResponse({ reply });
        })
        .receive("error", (reason: unknown) => {
          sendResponse({ error: "sync_check_failed", reason });
        });

      return true;
    }

    case "GET_SESSION_STATE": {
      broadcastToAll({ type: "SESSION_STATE", session });
      sendResponse({ type: "SESSION_STATE", session });
      return false;
    }

    default:
      return false;
  }
}

export default defineBackground(() => {
  // Background service worker initialized
  chrome.runtime.onMessage.addListener(messageHandler);
});
