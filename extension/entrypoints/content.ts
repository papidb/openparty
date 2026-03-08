type HostEventName = "play" | "pause" | "seek";

type PlaybackStatus = "playing" | "paused";

interface PlaybackState {
  positionMs: number;
  status: PlaybackStatus;
  revision?: number;
}

interface RoomJoinedMessage {
  type: "ROOM_JOINED";
  isHost: boolean;
  snapshot?: {
    revision?: number;
  };
}

interface PlaybackUpdateMessage {
  type: "PLAYBACK_UPDATE";
  state?: PlaybackState;
}

interface RoomLeftMessage {
  type: "ROOM_LEFT";
}

interface CorrectiveSnapshotMessage {
  type: "CORRECTIVE_SNAPSHOT";
  snapshot?: {
    playback_state?: PlaybackStatus;
    base_position_ms?: number;
    revision?: number;
  };
}

interface MinorDriftMessage {
  type: "MINOR_DRIFT";
  driftMs?: number;
}

type RuntimeInboundMessage =
  | RoomJoinedMessage
  | PlaybackUpdateMessage
  | RoomLeftMessage
  | CorrectiveSnapshotMessage
  | MinorDriftMessage;

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let currentVideo: HTMLVideoElement | null = null;
    let isHost = false;
    let guestMode = false;
    let syncInterval: ReturnType<typeof setInterval> | null = null;
    let detectedVideo = false;
    let lastRevision = 0;

    const notifyVideoStatus = (detected: boolean) => {
      try {
        chrome.runtime.sendMessage({ type: "VIDEO_STATUS", detected });
      } catch {}
    };

    const sendHostEvent = (event: HostEventName, video: HTMLVideoElement) => {
      try {
        chrome.runtime.sendMessage({
          type: "HOST_EVENT",
          event,
          positionMs: Math.floor(video.currentTime * 1000)
        });
      } catch {}
    };

    const handlePlay = (event: Event) => {
      sendHostEvent("play", event.target as HTMLVideoElement);
    };

    const handlePause = (event: Event) => {
      sendHostEvent("pause", event.target as HTMLVideoElement);
    };

    const handleSeeked = (event: Event) => {
      sendHostEvent("seek", event.target as HTMLVideoElement);
    };

    const attachVideoListeners = (video: HTMLVideoElement) => {
      if (!isHost) {
        return;
      }

      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeked", handleSeeked);
    };

    const detachVideoListeners = () => {
      if (!currentVideo) {
        return;
      }

      currentVideo.removeEventListener("play", handlePlay);
      currentVideo.removeEventListener("pause", handlePause);
      currentVideo.removeEventListener("seeked", handleSeeked);
    };

    const findLargestVisibleVideo = (): HTMLVideoElement | null => {
      const videos = Array.from(document.querySelectorAll("video"));
      const visibleVideos = videos.filter((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
      });

      if (visibleVideos.length === 0) {
        return null;
      }

      return visibleVideos.reduce((largest, video) => {
        const rect = video.getBoundingClientRect();
        const largestRect = largest.getBoundingClientRect();
        const area = rect.width * rect.height;
        const largestArea = largestRect.width * largestRect.height;
        return area > largestArea ? video : largest;
      });
    };

    const applyPlaybackState = (state: PlaybackState) => {
      if (!currentVideo) {
        return;
      }

      const targetMs = state.positionMs;
      const currentMs = Math.floor(currentVideo.currentTime * 1000);

      if (Math.abs(targetMs - currentMs) > 500) {
        currentVideo.currentTime = targetMs / 1000;
      }

      if (state.status === "playing" && currentVideo.paused) {
        currentVideo.play().catch(() => {});
      } else if (state.status === "paused" && !currentVideo.paused) {
        currentVideo.pause();
      }
    };

    const doSyncCheck = () => {
      if (!currentVideo || !guestMode) {
        return;
      }

      try {
        chrome.runtime.sendMessage({
          type: "SYNC_CHECK",
          positionMs: Math.floor(currentVideo.currentTime * 1000),
          lastRevision
        });
      } catch {}
    };

    const checkForVideo = () => {
      const video = findLargestVisibleVideo();
      const isDetected = !!video;

      if (isDetected !== detectedVideo) {
        detectedVideo = isDetected;
        notifyVideoStatus(isDetected);
      }

      if (!video) {
        if (currentVideo) {
          detachVideoListeners();
          currentVideo = null;
        }

        return;
      }

      if (video !== currentVideo) {
        detachVideoListeners();
        currentVideo = video;
        attachVideoListeners(video);
      }
    };

    const observer = new MutationObserver(() => {
      checkForVideo();
    });

    const startObserver = () => {
      const target = document.body ?? document.documentElement;
      observer.observe(target, { childList: true, subtree: true });
    };

    chrome.runtime.onMessage.addListener((message: RuntimeInboundMessage) => {
      switch (message.type) {
        case "ROOM_JOINED": {
          isHost = message.isHost;
          guestMode = !message.isHost;

          import("./sidebar/mount")
            .then(({ mountSidebar }) => {
              mountSidebar();
            })
            .catch(() => {
            });
          if (typeof message.snapshot?.revision === "number") {
            lastRevision = message.snapshot.revision;
          }

          if (currentVideo) {
            detachVideoListeners();
            attachVideoListeners(currentVideo);
          }

          if (guestMode && !syncInterval) {
            syncInterval = setInterval(doSyncCheck, 7000);
          }

          if (!guestMode && syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
          }

          break;
        }

        case "PLAYBACK_UPDATE": {
          if (guestMode && currentVideo && message.state) {
            applyPlaybackState(message.state);
            if (typeof message.state.revision === "number") {
              lastRevision = message.state.revision;
            }
          }

          break;
        }

        case "CORRECTIVE_SNAPSHOT": {
          if (currentVideo && message.snapshot) {
            const snap = message.snapshot;
            const targetMs = typeof snap.base_position_ms === "number" ? snap.base_position_ms : 0;
            const currentMs = Math.floor(currentVideo.currentTime * 1000);

            if (Math.abs(targetMs - currentMs) > 200) {
              currentVideo.currentTime = targetMs / 1000;
            }

            if (snap.playback_state === "playing" && currentVideo.paused) {
              currentVideo.play().catch(() => {});
            } else if (snap.playback_state === "paused" && !currentVideo.paused) {
              currentVideo.pause();
            }

            if (typeof snap.revision === "number") {
              lastRevision = snap.revision;
            }
          }

          break;
        }

        case "MINOR_DRIFT": {
          break;
        }

        case "ROOM_LEFT": {
          isHost = false;
          guestMode = false;
          lastRevision = 0;

          import("./sidebar/mount")
            .then(({ unmountSidebar }) => {
              unmountSidebar();
            })
            .catch(() => {
            });

          if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
          }
          if (currentVideo) {
            detachVideoListeners();
          }
          break;
        }

        default:
          break;
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          startObserver();
          checkForVideo();
        },
        { once: true }
      );
    } else {
      startObserver();
      checkForVideo();
    }

    window.addEventListener("resize", checkForVideo);
    window.addEventListener("scroll", checkForVideo, { passive: true });
  }
});
