import { Socket } from "phoenix";

export default defineBackground(() => {
  console.log("[OpenParty] Background service worker ready");
});

export function connectSocket(token: string, wsUrl: string): Socket {
  return new Socket(wsUrl, {
    params: { token },
    transport: WebSocket
  });
}
