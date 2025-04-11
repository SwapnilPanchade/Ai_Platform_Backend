import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "./models/User";

interface SocketUserData {
  userId: string;
  role: UserRole;
}

declare module "socket.io" {
  interface Socket {
    user?: SocketUserData;
  }
}

const authenticateSocket = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token) {
    console.error("WS Auth Error : No token provided");
    return next(new Error("Authentication Error : No token provided"));
  }
  if (!jwtSecret) {
    console.error(
      "WS Auth Error: JWT_SECRET not set in environment variables."
    );
    return next(new Error("Server configuration error Auth Point"));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload & {
      userId: string;
      role: UserRole;
    };
    socket.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
    console.log(
      `WS User Authenticated: ${socket.user.userId} (${socket.user.role})`
    );
    next();
  } catch (err) {
    console.error(`WS Auth Error : Invalid token`, err);
    next(new Error("Authentication error: Invalid token"));
  }
};
export const setupWebSocket = (io: Server) => {
  io.use(authenticateSocket);

  io.on("connection", (socket: Socket) => {
    console.log(
      `WS User Connected: ${socket.user?.userId} (Socket ID: ${socket.id})`
    );

    if (socket.user?.userId) {
      socket.join(socket.user.userId);
      console.log(`Socket ${socket.id} joined room: ${socket.user.userId}`);
    }

    socket.on(
      "sendMessage",
      (data: { recipientId?: string; message: string }) => {
        if (!socket.user) {
          console.error(
            `WS Error: Received message from unauthenticated socket ${socket.id}`
          );

          socket.emit("errorMessage", { error: "Authentication required" });
          return;
        }

        console.log(`WS Message from ${socket.user.userId}:`, data);

        if (data.recipientId) {
          console.log(
            `WS Relaying message from ${socket.user.userId} to room ${data.recipientId}`
          );

          io.to(data.recipientId).emit("receiveMessage", {
            senderId: socket.user.userId, 
            message: data.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log(
            `WS No recipient specified for message from ${socket.user.userId}`
          );
          socket.emit("errorMessage", { error: "No recipient specified" });
        }
      }
    );

    socket.on("disconnect", (reason: string) => {
      console.log(
        `WS User Disconnected: ${socket.user?.userId} (Socket ID: ${socket.id}). Reason: ${reason}`
      );
    });

    socket.on("error", (error: Error) => {
      console.error(
        `WS Socket Error on ${socket.user?.userId} (Socket ID: ${socket.id}):`,
        error
      );
    });
  });

  console.log("WebSocket server initialized and listening for connections.");
};
