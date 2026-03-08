declare function defineBackground(callback: () => void): unknown;

declare module "phoenix" {
  export class Socket {
    constructor(
      endPoint: string,
      opts?: {
        params?: Record<string, string>;
        transport?: typeof WebSocket;
      }
    );
  }
}
