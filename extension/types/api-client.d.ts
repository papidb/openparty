declare module "@openparty/api-client" {
  export function createToken(
    apiBase: string,
    email: string,
    password: string
  ): Promise<{ token: string }>;

  export function createRoom(
    apiBase: string,
    token: string
  ): Promise<{ room_id: string; invite_code: string; status?: string }>;

  export function getRoomByInviteCode(
    apiBase: string,
    token: string,
    code: string
  ): Promise<{ room_id: string; invite_code: string; status?: string }>;

  export function getRoomById(
    apiBase: string,
    token: string,
    roomId: string
  ): Promise<{ room_id: string; invite_code: string; status?: string }>;
}
