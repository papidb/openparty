import { describe, expect, it } from "vitest";

type ActivityType = "join" | "leave" | "play" | "pause" | "seek" | "sync";

interface ActivityEntry {
  id: string;
  type: ActivityType;
  displayName: string;
  timestamp: number;
  detail?: string;
}

function filterActivities(activities: ActivityEntry[], detailMode: boolean): ActivityEntry[] {
  if (detailMode) {
    return activities;
  }

  return activities.filter((entry) => ["join", "leave", "play", "pause"].includes(entry.type));
}

function getDisplayName(raw: string | undefined): string {
  if (!raw || raw.trim() === "") {
    return "Anonymous";
  }

  return raw;
}

function addActivity(prev: ActivityEntry[], entry: Omit<ActivityEntry, "id" | "timestamp">): ActivityEntry[] {
  const newEntry: ActivityEntry = {
    ...entry,
    id: `${Date.now()}-test`,
    timestamp: Date.now()
  };

  const updated = [...prev, newEntry];
  return updated.length > 200 ? updated.slice(-200) : updated;
}

describe("Activity log filtering", () => {
  const entries: ActivityEntry[] = [
    { id: "1", type: "join", displayName: "Alice", timestamp: 1 },
    { id: "2", type: "play", displayName: "Host", timestamp: 2 },
    { id: "3", type: "seek", displayName: "Host", timestamp: 3, detail: "to 1:30" },
    { id: "4", type: "sync", displayName: "System", timestamp: 4, detail: "drift corrected" },
    { id: "5", type: "pause", displayName: "Host", timestamp: 5 },
    { id: "6", type: "leave", displayName: "Bob", timestamp: 6 }
  ];

  it("simple mode shows only join/leave/play/pause", () => {
    const filtered = filterActivities(entries, false);
    expect(filtered.map((entry) => entry.type)).toEqual(["join", "play", "pause", "leave"]);
    expect(filtered.some((entry) => entry.type === "seek")).toBe(false);
    expect(filtered.some((entry) => entry.type === "sync")).toBe(false);
  });

  it("detailed mode shows all entries", () => {
    const filtered = filterActivities(entries, true);
    expect(filtered).toHaveLength(6);
    expect(filtered.some((entry) => entry.type === "seek")).toBe(true);
    expect(filtered.some((entry) => entry.type === "sync")).toBe(true);
  });
});

describe("Display name fallback", () => {
  it("returns name when present", () => {
    expect(getDisplayName("Alice")).toBe("Alice");
  });

  it("returns Anonymous for empty string", () => {
    expect(getDisplayName("")).toBe("Anonymous");
  });

  it("returns Anonymous for whitespace", () => {
    expect(getDisplayName("   ")).toBe("Anonymous");
  });

  it("returns Anonymous for undefined", () => {
    expect(getDisplayName(undefined)).toBe("Anonymous");
  });
});

describe("Activity log cap", () => {
  it("caps at 200 entries", () => {
    let log: ActivityEntry[] = [];
    for (let index = 0; index < 205; index += 1) {
      log = addActivity(log, { type: "join", displayName: `User${index}` });
    }

    expect(log).toHaveLength(200);
    expect(log[log.length - 1].displayName).toBe("User204");
  });

  it("does not cap below 200", () => {
    let log: ActivityEntry[] = [];
    for (let index = 0; index < 50; index += 1) {
      log = addActivity(log, { type: "play", displayName: "Host" });
    }

    expect(log).toHaveLength(50);
  });
});
