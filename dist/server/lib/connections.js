"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isConnected = isConnected;
exports.requireConnection = requireConnection;
/**
 * Check whether two users have a mutual (ACCEPTED) connection.
 * Used as a guard in messaging resolvers and group invite flows.
 *
 * Task 2.2.3 / 2.3.3 — standalone isConnected utility
 */
async function isConnected(userAId, userBId, prisma) {
    const connection = await prisma.friendship.findFirst({
        where: {
            OR: [
                { requesterId: userAId, addresseeId: userBId, status: 'ACCEPTED' },
                { requesterId: userBId, addresseeId: userAId, status: 'ACCEPTED' },
            ],
        },
    });
    return !!connection;
}
/**
 * Throws if two users are NOT mutually connected.
 * Drop-in guard for resolvers that require an existing connection before proceeding.
 */
async function requireConnection(userAId, userBId, prisma) {
    const connected = await isConnected(userAId, userBId, prisma);
    if (!connected) {
        throw new Error('Users are not connected');
    }
}
