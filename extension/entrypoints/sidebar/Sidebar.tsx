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
      displayName: participant.displayName || "Anonymous",
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
  const participantsRef = useRef<Participant[]>([]);

  const appendActivities = useCallback((entries: Array<Omit<ActivityEntry, "id">>) => {
    if (entries.length === 0) {
      return;
    }

    setActivities((previous) => {
      const nextEntries = entries.map((entry, index) => ({
        ...entry,
        id: `${entry.type}-${entry.timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`
      }));

      const merged = [...previous, ...nextEntries];
      return merged.slice(Math.max(0, merged.length - MAX_ACTIVITIES));
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
          appendActivities([
            {
              type: "sync",
              displayName: runtimeMessage.isHost ? "Host" : "You",
              timestamp: Date.now(),
              detail: runtimeMessage.isHost ? "party started" : "party joined"
            }
          ]);
          break;
        }

        case "PLAYBACK_UPDATE": {
          if (!runtimeMessage.state) {
            return;
          }

          const hostName =
            participantsRef.current.find((participant) => participant.userId === runtimeMessage.state?.hostUserId)
              ?.displayName ?? "Host";

          const type: ActivityType = runtimeMessage.state.status === "playing" ? "play" : "pause";
          appendActivities([
            {
              type,
              displayName: hostName,
              timestamp: Date.now(),
              detail: `at ${formatPosition(runtimeMessage.state.positionMs)}`
            }
          ]);
          break;
        }

        case "PRESENCE_UPDATE": {
          const nextParticipants = normalizeParticipants(runtimeMessage.participants);
          const previousParticipants = participantsRef.current;
          const previousIds = new Set(previousParticipants.map((participant) => participant.userId));
          const nextIds = new Set(nextParticipants.map((participant) => participant.userId));

          const now = Date.now();
          const joinedEntries = nextParticipants
            .filter((participant) => !previousIds.has(participant.userId))
            .map((participant) => ({
              type: "join" as const,
              displayName: participant.displayName,
              timestamp: now
            }));

          const leftEntries = previousParticipants
            .filter((participant) => !nextIds.has(participant.userId))
            .map((participant) => ({
              type: "leave" as const,
              displayName: participant.displayName,
              timestamp: now
            }));

          participantsRef.current = nextParticipants;
          setParticipants(nextParticipants);
          appendActivities([...joinedEntries, ...leftEntries]);
          break;
        }

        case "ROOM_LEFT": {
          participantsRef.current = [];
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
  }, [appendActivities]);

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
