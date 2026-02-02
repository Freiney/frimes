import { io, Socket } from "socket.io-client";

export function createSocket(token: string): Socket {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

  return io(socketUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: {
      token,
    },
  });
}
