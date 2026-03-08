import { describe, expect, it, vi } from "vitest";

type PlaybackStatus = "playing" | "paused";

interface SnapshotState {
  status: PlaybackStatus;
  positionMs: number;
  revision: number;
  hostUserId: string;
}

interface PlaybackUpdatedPayload {
  playback_state?: PlaybackStatus;
  base_position_ms?: number;
  revision?: number;
  host_user_id?: string;
}

function mergePlayback(snapshot: SnapshotState, update: PlaybackUpdatedPayload): SnapshotState {
  return {
    ...snapshot,
    status: update.playback_state ?? snapshot.status,
    positionMs: update.base_position_ms ?? snapshot.positionMs,
    revision: update.revision ?? snapshot.revision,
    hostUserId: update.host_user_id ?? snapshot.hostUserId
  };
}

describe("Video selection heuristic", () => {
  it("selects largest visible video", () => {
    const makeVideo = (width: number, height: number, top = 0) => {
      const video = document.createElement("video");
      vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
        width,
        height,
        top,
        bottom: top + height,
        left: 0,
        right: width,
        x: 0,
        y: top,
        toJSON: () => ({})
      } as DOMRect);
      return video;
    };

    const small = makeVideo(100, 100);
    const large = makeVideo(800, 450);
    const offscreen = makeVideo(800, 450, -1000);

    const videos = [small, large, offscreen];
    const visible = videos.filter((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
    });

    const largest = visible.reduce((current, candidate) => {
      const currentRect = current.getBoundingClientRect();
      const candidateRect = candidate.getBoundingClientRect();
      const currentArea = currentRect.width * currentRect.height;
      const candidateArea = candidateRect.width * candidateRect.height;
      return candidateArea > currentArea ? candidate : current;
    });

    expect(largest).toBe(large);
    expect(visible).not.toContain(offscreen);
  });
});

describe("Playback state merge", () => {
  it("merges partial playback_updated into snapshot", () => {
    const snapshot: SnapshotState = {
      status: "paused",
      positionMs: 10_000,
      revision: 1,
      hostUserId: "user-1"
    };

    const update: PlaybackUpdatedPayload = {
      playback_state: "playing",
      base_position_ms: 12_000,
      revision: 2
    };

    const merged = mergePlayback(snapshot, update);

    expect(merged.status).toBe("playing");
    expect(merged.positionMs).toBe(12_000);
    expect(merged.revision).toBe(2);
    expect(merged.hostUserId).toBe("user-1");
  });

  it("handles partial update without position", () => {
    const snapshot: SnapshotState = {
      status: "playing",
      positionMs: 5_000,
      revision: 1,
      hostUserId: "u1"
    };

    const update: PlaybackUpdatedPayload = {
      playback_state: "paused",
      revision: 2
    };

    const merged = mergePlayback(snapshot, update);

    expect(merged.status).toBe("paused");
    expect(merged.positionMs).toBe(5_000);
    expect(merged.revision).toBe(2);
    expect(merged.hostUserId).toBe("u1");
  });
});
