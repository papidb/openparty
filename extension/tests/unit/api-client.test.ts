import { beforeEach, describe, expect, it, vi } from "vitest";

const clientPath = "../../../shared/api-client/src/client.js";

describe("createToken", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns token on success", async () => {
    const { createToken } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "abc123" })
    } as Response);

    const result = await createToken("http://localhost:4000", "user@test.com", "pass");
    expect(result.token).toBe("abc123");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/tokens",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on non-ok response", async () => {
    const { createToken } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401
    } as Response);

    await expect(createToken("http://localhost:4000", "bad@test.com", "wrong")).rejects.toThrow(
      "Token request failed: 401"
    );
  });
});

describe("createRoom", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("posts to /api/rooms with bearer token", async () => {
    const { createRoom } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ room_id: "room-1", invite_code: "ABC123", status: "active" })
    } as Response);

    const result = await createRoom("http://localhost:4000", "mytoken");
    expect(result.room_id).toBe("room-1");
    expect(result.invite_code).toBe("ABC123");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/rooms",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer mytoken" })
      })
    );
  });

  it("throws on non-ok response", async () => {
    const { createRoom } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403
    } as Response);

    await expect(createRoom("http://localhost:4000", "badtoken")).rejects.toThrow("Room creation failed: 403");
  });
});

describe("getRoomByInviteCode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches room by invite code", async () => {
    const { getRoomByInviteCode } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ room_id: "room-2", invite_code: "XYZ" })
    } as Response);

    const result = await getRoomByInviteCode("http://localhost:4000", "tok", "XYZ");
    expect(result.room_id).toBe("room-2");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/rooms/code/XYZ",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer tok" })
      })
    );
  });

  it("throws on 404", async () => {
    const { getRoomByInviteCode } = await import(clientPath);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    await expect(getRoomByInviteCode("http://localhost:4000", "tok", "INVALID")).rejects.toThrow(
      "Room lookup failed: 404"
    );
  });
});
