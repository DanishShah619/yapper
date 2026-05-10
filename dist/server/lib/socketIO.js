"use strict";
// lib/socketIO.ts
// Singleton accessor for the Socket.IO server instance.
//
// The `io` instance is created in server.ts inside main().
// This module stores a reference so any other module (resolvers, keyDelivery, etc.)
// can import and use it without circular dependency issues.
//
// Call setIO(io) once from server.ts after creating the io instance.
// Call getIO() everywhere else.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setIO = setIO;
exports.getIO = getIO;
exports.tryGetIO = tryGetIO;
const globalForSocketIO = globalThis;
/** Called once from server.ts right after io is created. */
function setIO(io) {
    globalForSocketIO.__nexchatIO = io;
}
/**
 * Returns the Socket.IO server instance.
 * Throws if called before setIO() — this indicates a startup order bug.
 */
function getIO() {
    if (!globalForSocketIO.__nexchatIO) {
        throw new Error('[socketIO] Socket.IO server not initialised yet. Call setIO(io) in server.ts first.');
    }
    return globalForSocketIO.__nexchatIO;
}
/** Returns the Socket.IO server when the custom server is running. */
function tryGetIO() {
    var _a;
    return (_a = globalForSocketIO.__nexchatIO) !== null && _a !== void 0 ? _a : null;
}
