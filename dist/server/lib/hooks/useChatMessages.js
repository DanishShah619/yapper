"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useChatMessages = useChatMessages;
const react_1 = require("@apollo/client/react");
const client_1 = require("@apollo/client");
const react_2 = require("react");
const socketClient_1 = require("@/lib/socketClient");
// messages() returns MessageConnection { edges: [Message!]!, pageInfo: PageInfo! }
const GET_MESSAGES = (0, client_1.gql) `
  query GetMessages($roomId: ID, $cursor: String, $limit: Int) {
    messages(roomId: $roomId, cursor: $cursor, limit: $limit) {
      edges {
        id
        roomId
        groupId
        encryptedPayload
        ephemeral
        expiresAt
        editedAt
        deletedAt
        createdAt
        sender { id username avatarUrl }
        file { id encryptedMetadata createdAt uploader { id username avatarUrl } }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
function isExpiredEphemeral(msg, now) {
    return msg.ephemeral && !!msg.expiresAt && new Date(msg.expiresAt).getTime() <= now;
}
function useChatMessages(roomId) {
    var _a, _b, _c, _d, _e;
    const [realtimeMessages, setRealtimeMessages] = (0, react_2.useState)([]);
    const [fetchedOlderMessages, setFetchedOlderMessages] = (0, react_2.useState)([]);
    const [now, setNow] = (0, react_2.useState)(() => Date.now());
    const { data, loading, error, fetchMore: apolloFetchMore } = (0, react_1.useQuery)(GET_MESSAGES, {
        variables: { roomId, limit: 50 },
        skip: !roomId,
        fetchPolicy: "network-only",
    });
    const messages = (0, react_2.useMemo)(() => {
        var _a, _b;
        const byId = new Map();
        const belongsToRoom = (msg) => msg.roomId === roomId || msg.groupId === roomId;
        for (const msg of fetchedOlderMessages) {
            if (belongsToRoom(msg) && !isExpiredEphemeral(msg, now))
                byId.set(msg.id, msg);
        }
        for (const msg of (_b = (_a = data === null || data === void 0 ? void 0 : data.messages) === null || _a === void 0 ? void 0 : _a.edges) !== null && _b !== void 0 ? _b : []) {
            if (!isExpiredEphemeral(msg, now))
                byId.set(msg.id, msg);
        }
        for (const msg of realtimeMessages) {
            if (belongsToRoom(msg) && !isExpiredEphemeral(msg, now))
                byId.set(msg.id, msg);
        }
        return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [(_a = data === null || data === void 0 ? void 0 : data.messages) === null || _a === void 0 ? void 0 : _a.edges, fetchedOlderMessages, realtimeMessages, roomId, now]);
    (0, react_2.useEffect)(() => {
        var _a, _b;
        const expiringMessages = [
            ...fetchedOlderMessages,
            ...((_b = (_a = data === null || data === void 0 ? void 0 : data.messages) === null || _a === void 0 ? void 0 : _a.edges) !== null && _b !== void 0 ? _b : []),
            ...realtimeMessages,
        ].filter((msg) => msg.ephemeral && msg.expiresAt && new Date(msg.expiresAt).getTime() > Date.now());
        if (expiringMessages.length === 0)
            return;
        const nextExpiry = Math.min(...expiringMessages.map((msg) => new Date(msg.expiresAt).getTime()));
        const delay = Math.max(nextExpiry - Date.now(), 0);
        const timeoutId = window.setTimeout(() => setNow(Date.now()), delay + 50);
        return () => window.clearTimeout(timeoutId);
    }, [(_b = data === null || data === void 0 ? void 0 : data.messages) === null || _b === void 0 ? void 0 : _b.edges, fetchedOlderMessages, realtimeMessages, now]);
    (0, react_2.useEffect)(() => {
        if (!roomId)
            return;
        const socket = (0, socketClient_1.getSocket)();
        const join = () => socket.emit("joinRoom", roomId);
        const handleMessage = (newMessage) => {
            if (newMessage.roomId !== roomId && newMessage.groupId !== roomId)
                return;
            setRealtimeMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id))
                    return prev;
                return [...prev, newMessage].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
        };
        const handleMessageUpdate = (updatedMessage) => {
            if (updatedMessage.roomId !== roomId && updatedMessage.groupId !== roomId)
                return;
            setRealtimeMessages((prev) => {
                const withoutUpdated = prev.filter((message) => message.id !== updatedMessage.id);
                return [...withoutUpdated, updatedMessage].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
        };
        if (socket.connected)
            join();
        socket.on("connect", join);
        socket.on("message:new", handleMessage);
        socket.on("message:updated", handleMessageUpdate);
        socket.on("message:deleted", handleMessageUpdate);
        return () => {
            socket.off("connect", join);
            socket.off("message:new", handleMessage);
            socket.off("message:updated", handleMessageUpdate);
            socket.off("message:deleted", handleMessageUpdate);
            socket.emit("leaveRoom", roomId);
        };
    }, [roomId]);
    const canLoadMore = (_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.messages) === null || _c === void 0 ? void 0 : _c.pageInfo) === null || _d === void 0 ? void 0 : _d.hasNextPage) !== null && _e !== void 0 ? _e : false;
    const fetchMore = async () => {
        var _a, _b, _c, _d;
        if (!roomId || !canLoadMore)
            return;
        const cursor = (_b = (_a = data === null || data === void 0 ? void 0 : data.messages) === null || _a === void 0 ? void 0 : _a.pageInfo) === null || _b === void 0 ? void 0 : _b.endCursor;
        try {
            const res = await apolloFetchMore({
                variables: { roomId, cursor, limit: 50 },
            });
            if ((_d = (_c = res.data) === null || _c === void 0 ? void 0 : _c.messages) === null || _d === void 0 ? void 0 : _d.edges) {
                const olderMessages = [...res.data.messages.edges].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                setFetchedOlderMessages((prev) => [...olderMessages, ...prev].filter((msg) => !isExpiredEphemeral(msg, Date.now())));
            }
        }
        catch (e) {
            console.error("Error fetching more messages", e);
        }
    };
    return { messages, loading, error, fetchMore, canLoadMore };
}
