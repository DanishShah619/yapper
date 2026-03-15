/**
 * Socket.IO Server Stub
 *
 * This module will be fully implemented in Phase 2+ when real-time
 * messaging, presence, and waiting room events are added.
 *
 * For Phase 1, this serves as a placeholder showing how Socket.IO
 * will integrate with the Next.js app and Redis adapter.
 */

// Socket.IO setup will be done in a custom server (server.ts)
// since Next.js App Router doesn't natively support WebSocket upgrades.
//
// Phase 2+ will:
// 1. Create a custom server.ts with Express + Socket.IO
// 2. Attach Redis adapter for horizontal scaling
// 3. Handle connection auth (JWT verification)
// 4. Define event namespaces: messaging, presence, video

export const SOCKET_EVENTS = {
  // Phase 2: Social Graph
  CONNECTION_REQUEST_RECEIVED: 'connectionRequest:received',

  // Phase 3: Messaging
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',

  // Phase 4: Video
  WAITING_JOINED: 'waiting:joined',
  WAITING_APPROVED: 'waiting:approved',
  WAITING_REJECTED: 'waiting:rejected',

  // Phase 6: Presence
  PRESENCE_HEARTBEAT: 'presence:heartbeat',
  PRESENCE_UPDATED: 'presence:updated',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
