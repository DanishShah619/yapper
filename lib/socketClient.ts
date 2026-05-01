import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

type GetSocketOptions = {
  connect?: boolean;
};

function getAuthPayload(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexchat_token") : null;
  return token ? { token } : {};
}

export function getSocket(options: GetSocketOptions = {}): Socket {
  const { connect = true } = options;

  if (!socket) {
    socket = io({
      path: "/socket.io",
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      auth: getAuthPayload(),
    });
  }

  if (connect && socket.disconnected) {
    socket.auth = getAuthPayload();
    socket.connect();
  }

  return socket;
}

export function reconnectSocket(): Socket {
  const activeSocket = getSocket({ connect: false });
  activeSocket.auth = getAuthPayload();
  if (activeSocket.connected) activeSocket.disconnect();
  activeSocket.connect();
  return activeSocket;
}

export function disconnectSocket(): void {
  if (socket) socket.disconnect();
}
