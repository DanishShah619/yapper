import { PrismaClient } from '@prisma/client';

/**
 * Check whether two users have a mutual (ACCEPTED) connection.
 * Used as a guard in messaging resolvers and group invite flows.
 *
 * Task 2.2.3 / 2.3.3 — standalone isConnected utility
 */
export async function isConnected(
  userAId: string,
  userBId: string,
  prisma: PrismaClient
): Promise<boolean> {
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
export async function requireConnection(
  userAId: string,
  userBId: string,
  prisma: PrismaClient
): Promise<void> {
  const connected = await isConnected(userAId, userBId, prisma);
  if (!connected) {
    throw new Error('Users are not connected');
  }
}
