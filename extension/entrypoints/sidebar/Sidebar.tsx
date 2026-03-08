import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ActivityType = "join" | "leave" | "play" | "pause" | "seek" | "sync";

interface ActivityEntry {
  id: string;
  type: ActivityType;
  displayName: string;
  timestamp: number;
  detail?: string;
}

interface Participant {
  userId: string;
  displayName: string;
  isHost: boolean;
}

interface PlaybackState {
  status: "playing" | "paused";
  positionMs: number;
  revision: number;
  hostUserId: string;
}

interface SidebarProps {
  onClose: () => void;
}

type RuntimeSidebarMessage =
  | {
      type: "ROOM_JOINED";
      isHost?: boolean;
    }
  | {
      type: "PLAYBACK_UPDATE";
      state?: PlaybackState;
    }
  | {
      type: "PRESENCE_UPDATE";
      participants?: Participant[];
    }
  | {
      type: "CORRECTIVE_SNAPSHOT";
      snapshot?: {
        playback_state?: "playing" | "paused";
        base_position_ms?: number;
        revision?: number;
      };
    }
  | {
      type: "ROOM_LEFT";
    };

const MAX_ACTIVITIES = 200;

const SIMPLE_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set(["join", "leave", "play", "pause"]);

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  join: "+",
  leave: "-",
  play: ">",
  pause: "||",
  seek: ">>",
  sync: "~"
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  join: "#35d07f",
  leave: "#ef6565",
  play: "#a983ff",
  pause: "#8f8fa0",
  seek: "#66b3ff",
  sync: "#7b7b8f"
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  join: "joined the party",
  leave: "left the party",
  play: "pressed play",
  pause: "paused playback",
  seek: "jumped in the timeline",
  sync: "synced state"
};

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPosition(positionMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(positionMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getDisplayName(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (value.length === 0) {
    return "Anonymous";
  }

  if (value.includes("@")) {
    const emailPrefix = value.split("@")[0]?.trim();
    return emailPrefix && emailPrefix.length > 0 ? emailPrefix : "Anonymous";
  }

  return value;
}

function normalizeParticipants(input: Participant[] | undefined): Participant[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const deduped = new Map<string, Participant>();
  for (const participant of input) {
    if (!participant || typeof participant.userId !== "string" || participant.userId.length === 0) {
      continue;
    }

    deduped.set(participant.userId, {
      userId: participant.userId,
      displayName: getDisplayName(participant.displayName),
      isHost: Boolean(participant.isHost)
    });
  }

  return Array.from(deduped.values());
}

export default function Sidebar({ onClose }: SidebarProps) {
  const participantCountId = "op-participant-count";
  const toggleDetailId = "op-toggle-detail";
  const sidebarCloseId = "op-sidebar-close";
  const activityLogId = "op-activity-log";

  const [detailMode, setDetailMode] = useState(false);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const prevParticipantsRef = useRef<Participant[]>([]);
  const playbackRef = useRef<PlaybackState | null>(null);

  const addActivity = useCallback((entry: Omit<ActivityEntry, "id" | "timestamp">) => {
    setActivities((previous) => {
      const nextEntry: ActivityEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now()
      };

      const merged = [...previous, nextEntry];
      return merged.length > MAX_ACTIVITIES ? merged.slice(-MAX_ACTIVITIES) : merged;
    });
  }, []);

  useEffect(() => {
    const handler = (message: unknown) => {
      if (!message || typeof message !== "object") {
        return;
      }

      const runtimeMessage = message as RuntimeSidebarMessage;
      switch (runtimeMessage.type) {
        case "ROOM_JOINED": {
          addActivity({
            type: "join",
            displayName: runtimeMessage.isHost ? "Host" : "You",
            detail: "party started"
          });
          break;
        }

        case "PLAYBACK_UPDATE": {
          if (!runtimeMessage.state) {
            return;
          }

          const state = runtimeMessage.state;

          const hostName = getDisplayName(
            prevParticipantsRef.current.find((participant) => participant.userId === state.hostUserId)?.displayName ?? "Host"
          );

          const previousPlayback = playbackRef.current;
          if (
            previousPlayback &&
            previousPlayback.status === state.status &&
            Math.abs(state.positionMs - previousPlayback.positionMs) >= 3000
          ) {
            addActivity({
              type: "seek",
              displayName: hostName,
              detail: `to ${formatPosition(state.positionMs)}`
            });
          }

          const type: ActivityType = state.status === "playing" ? "play" : "pause";
          addActivity({
            type,
            displayName: hostName,
            detail: `at ${formatPosition(state.positionMs)}`
          });
          playbackRef.current = state;
          break;
        }

        case "PRESENCE_UPDATE": {
          const nextParticipants = normalizeParticipants(runtimeMessage.participants);
          const previousParticipants = prevParticipantsRef.current;

          const joined = nextParticipants.filter(
            (nextParticipant) => !previousParticipants.some((prevParticipant) => prevParticipant.userId === nextParticipant.userId)
          );

          const left = previousParticipants.filter(
            (prevParticipant) => !nextParticipants.some((nextParticipant) => nextParticipant.userId === prevParticipant.userId)
          );

          for (const participant of joined) {
            addActivity({
              type: "join",
              displayName: getDisplayName(participant.displayName)
            });
          }

          for (const participant of left) {
            addActivity({
              type: "leave",
              displayName: getDisplayName(participant.displayName)
            });
          }

          prevParticipantsRef.current = nextParticipants;
          setParticipants(nextParticipants);
          break;
        }

        case "CORRECTIVE_SNAPSHOT": {
          const position = runtimeMessage.snapshot?.base_position_ms;
          const detail =
            typeof position === "number" ? `drift corrected to ${formatPosition(position)}` : "drift corrected";

          addActivity({
            type: "sync",
            displayName: "System",
            detail
          });
          break;
        }

        case "ROOM_LEFT": {
          prevParticipantsRef.current = [];
          playbackRef.current = null;
          setParticipants([]);
          setActivities([]);
          break;
        }

        default:
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [addActivity]);

  const visibleActivities = useMemo(
    () =>
      detailMode
        ? activities
        : activities.filter((entry) => {
            return SIMPLE_ACTIVITY_TYPES.has(entry.type);
          }),
    [activities, detailMode]
  );

  return (
    <aside className="op-shell" aria-label="OpenParty activity sidebar">
      <header className="op-header">
        <div className="op-brand-wrap">
          <div className="op-brand-mark" aria-hidden>
            OP
          </div>
          <div className="op-brand-copy">
            <div className="op-brand-title">OpenParty</div>
            <div id={participantCountId} className="op-count-pill">
              {participants.length} watching
            </div>
          </div>
        </div>

        <div className="op-actions">
          <button
            id={toggleDetailId}
            type="button"
            className={`op-toggle ${detailMode ? "is-on" : ""}`}
            onClick={() => setDetailMode((previous) => !previous)}
          >
            {detailMode ? "Simple" : "Detailed"}
          </button>
          <button id={sidebarCloseId} type="button" className="op-close" onClick={onClose} aria-label="Close sidebar">
            x
          </button>
        </div>
      </header>

      <div id={activityLogId} className="op-activity-log">
        {visibleActivities.length === 0 ? (
          <div className="op-empty">Activity appears here when your party starts moving.</div>
        ) : (
          visibleActivities.map((entry) => <ActivityItem key={entry.id} entry={entry} />)
        )}
      </div>

      {participants.length > 0 && (
        <footer className="op-participants">
          <div className="op-participants-label">Participants</div>
          <div className="op-participants-list">
            {participants.map((participant) => (
              <span key={participant.userId} className={`op-chip ${participant.isHost ? "is-host" : ""}`}>
                {participant.displayName}
                {participant.isHost ? " (host)" : ""}
              </span>
            ))}
          </div>
        </footer>
      )}
    </aside>
  );
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <article className="op-activity-item">
      <span className="op-activity-icon" style={{ color: ACTIVITY_COLORS[entry.type] }}>
        {ACTIVITY_ICONS[entry.type]}
      </span>
      <div className="op-activity-copy">
        <p className="op-activity-line">
          <strong>{entry.displayName}</strong> {ACTIVITY_LABELS[entry.type]}
          {entry.detail ? <span className="op-activity-detail"> {entry.detail}</span> : null}
        </p>
      </div>
      <time className="op-activity-time">{formatClock(entry.timestamp)}</time>
    </article>
  );
}
