// server.ts
// Custom Express + Socket.IO server for NexChat
// Integrates with Next.js App Router, Redis adapter, JWT auth

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import next from 'next';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

async function main() {
  await app.prepare();
  const server = express();
  const httpServer = createServer(server);

  // Redis clients for Socket.IO adapter
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();

  // Socket.IO setup
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io',
  });
  io.adapter(createAdapter(pubClient, subClient));

  // JWT auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
      (socket as any).user = payload;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Event namespaces
  io.on('connection', (socket) => {
    // Messaging events
    socket.on('message:new', (data) => {
      // Broadcast to room
      io.to(data.roomId).emit('message:new', data);
    });
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });
    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
    });
    // Presence events
    socket.on('presence:online', () => {
      // Implement presence logic (e.g., set Redis key)
    });
    socket.on('disconnect', () => {
      // Handle disconnect, update presence
    });
    // Video/waiting room events
    socket.on('waiting:joined', (data) => {
      // Handle waiting room join
    });
    // Add more event handlers as needed
  });

  // Next.js request handler
  server.all('*', (req, res) => handle(req, res));

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
