import { vi } from "vitest";

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((_keys, callback) => callback({})),
      set: vi.fn((_values, callback) => callback && callback()),
      remove: vi.fn((_keys, callback) => callback && callback())
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  tabs: {
    query: vi.fn((_query, callback) => callback([])),
    sendMessage: vi.fn()
  }
};

(globalThis as { chrome?: typeof chromeMock }).chrome = chromeMock;
