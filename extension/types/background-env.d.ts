declare function defineBackground(callback: () => void): unknown;

declare const chrome: any;

declare module "phoenix" {
  export class Push {
    receive(status: "ok" | "error" | string, callback: (response: any) => void): Push;
  }

  export class Channel {
    state: string;
    join(): Push;
    leave(): void;
    on(event: string, callback: (payload: any) => void): void;
    push(event: string, payload: Record<string, unknown>): Push;
  }

  export class Socket {
    constructor(
      endPoint: string,
      opts?: {
        params?: Record<string, string>;
        transport?: typeof WebSocket;
      }
    );
    connect(): void;
    disconnect(): void;
    onOpen(callback: () => void): void;
    onError(callback: (error: unknown) => void): void;
    channel(topic: string, params: Record<string, unknown>): Channel;
  }
}
