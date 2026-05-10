"use strict";
// lib/redisKeys.ts
// Central registry of all Redis key patterns used in NexChat.
// Always import from here — never hardcode Redis key strings in business logic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_REDELIVERY_ATTEMPTS = exports.STALE_SHARD_THRESHOLD_MINUTES = exports.RedisKeys = void 0;
exports.RedisKeys = {
    // Real-time delivery status mirror for a specific member in a room
    // TTL: 24 hours (member will re-fetch if they reconnect after expiry)
    keyDeliveryStatus: (roomId, userId) => `keydelivery:${roomId}:${userId}`,
    // Set of userIds with stale shards in a room (PENDING > threshold)
    // TTL: 1 hour (refreshed by the stale detection job)
    staleShards: (roomId) => `keydelivery:stale:${roomId}`,
    // Cached key health score for a room (0-100 percentage)
    // TTL: 30 seconds (refreshed on any status change)
    keyHealthScore: (roomId) => `keyhealth:${roomId}`,
    // Lock to prevent concurrent re-delivery for the same member
    // TTL: 30 seconds (auto-releases if process crashes)
    redeliveryLock: (roomId, userId) => `redelivery:lock:${roomId}:${userId}`,
    // Set of userIds currently waiting to be approved for a video room
    // TTL: 24 hours (cleared when room closes)
    waitingRoom: (roomId) => `waitingroom:${roomId}`,
    // Lock state of a video room (locked/unlocked)
    // TTL: 24 hours (cleared when room closes)
    videoRoomLock: (roomId) => `videoroom:lock:${roomId}`,
};
// Threshold in minutes — a shard is considered "stale" if it stays
// PENDING or DELIVERED without progressing for longer than this
exports.STALE_SHARD_THRESHOLD_MINUTES = 15;
// Maximum number of re-delivery attempts before giving up and alerting admin
exports.MAX_REDELIVERY_ATTEMPTS = 3;
