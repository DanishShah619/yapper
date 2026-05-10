"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePresence = usePresence;
const react_1 = require("react");
const react_2 = require("@apollo/client/react");
const client_1 = require("@apollo/client");
const PRESENCE_UPDATED = (0, client_1.gql) `
  subscription OnPresenceUpdated($userId: ID!) {
    presenceUpdated(userId: $userId) {
      userId
      online
    }
  }
`;
function usePresence(userIds) {
    const [presenceMap, setPresenceMap] = (0, react_1.useState)(new Map());
    const client = (0, react_2.useApolloClient)();
    (0, react_1.useEffect)(() => {
        if (!userIds || userIds.length === 0)
            return;
        const subscriptions = userIds.map((userId) => {
            return client.subscribe({
                query: PRESENCE_UPDATED,
                variables: { userId },
            }).subscribe({
                next: ({ data }) => {
                    if (data === null || data === void 0 ? void 0 : data.presenceUpdated) {
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
