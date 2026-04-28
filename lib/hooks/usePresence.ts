"use client";

import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';

const PRESENCE_UPDATED = gql`
  subscription OnPresenceUpdated($userId: ID!) {
    presenceUpdated(userId: $userId) {
      userId
      online
    }
  }
`;

export function usePresence(userIds: string[]) {
  const [presenceMap, setPresenceMap] = useState<Map<string, boolean>>(new Map());
  const client = useApolloClient();

  useEffect(() => {
    if (!userIds || userIds.length === 0) return;

    const subscriptions = userIds.map((userId) => {
      return client.subscribe<{ presenceUpdated: { userId: string; online: boolean } }>({
        query: PRESENCE_UPDATED,
        variables: { userId },
      }).subscribe({
        next: ({ data }) => {
          if (data?.presenceUpdated) {
            setPresenceMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(data.presenceUpdated.userId, data.presenceUpdated.online);
              return newMap;
            });
          }
        },
        error: (err) => console.error("Presence sub error:", err),
      });
    });

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [userIds.join(','), client]);

  return presenceMap;
}
