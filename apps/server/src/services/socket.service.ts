import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketServer;

export function initSocket(server: HttpServer): void {
  io = new SocketServer(server, {
    cors: {
      // Dev: reflect any origin (localhost + LAN IP both in play). Prod: CLIENT_URL only.
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.CLIENT_URL || 'http://localhost:3000')
        : true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        type: 'staff' | 'guest';
        role: string;
        restaurantId?: string;
        sessionId?: string;
      };
      (socket as any).decoded = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const decoded = (socket as any).decoded as {
      type: string;
      role: string;
      restaurantId?: string;
      sessionId?: string;
    };

    if (decoded.type === 'staff') {
      const rid = decoded.restaurantId;
      if (decoded.role === 'kitchen')  socket.join(`kitchen:${rid}`);
      if (decoded.role === 'cashier')  socket.join(`cashier:${rid}`);
      if (decoded.role === 'owner')    socket.join(`cashier:${rid}`); // owner sees cashier feed too
    }

    if (decoded.type === 'guest' && decoded.sessionId) {
      socket.join(`table:${decoded.sessionId}`);
    }

    socket.on('disconnect', () => {
      // rooms auto-cleaned by socket.io on disconnect
    });
  });
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
