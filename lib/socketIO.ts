// lib/socketIO.ts
// Singleton accessor for the Socket.IO server instance.
//
// The `io` instance is created in server.ts inside main().
// This module stores a reference so any other module (resolvers, keyDelivery, etc.)
// can import and use it without circular dependency issues.
//
// Call setIO(io) once from server.ts after creating the io instance.
// Call getIO() everywhere else.

import { Server as SocketIOServer } from 'socket.io';

const globalForSocketIO = globalThis as typeof globalThis & {
  __nexchatIO?: SocketIOServer;
};

/** Called once from server.ts right after io is created. */
export function setIO(io: SocketIOServer): void {
  globalForSocketIO.__nexchatIO = io;
}

/**
 * Returns the Socket.IO server instance.
 * Throws if called before setIO() — this indicates a startup order bug.
 */
export function getIO(): SocketIOServer {
  if (!globalForSocketIO.__nexchatIO) {
    throw new Error('[socketIO] Socket.IO server not initialised yet. Call setIO(io) in server.ts first.');
  }
  return globalForSocketIO.__nexchatIO;
}

/** Returns the Socket.IO server when the custom server is running. */
export function tryGetIO(): SocketIOServer | null {
  return globalForSocketIO.__nexchatIO ?? null;
}
