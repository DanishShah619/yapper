"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useConversations = useConversations;
const react_1 = require("@apollo/client/react");
const client_1 = require("@apollo/client");
const react_2 = require("react");
const socketClient_1 = require("@/lib/socketClient");
const GET_CONVERSATIONS = (0, client_1.gql) `
  query GetConversations {
    conversations {
      id
      name
      type
      createdAt
      members {
        id
        user { id username avatarUrl }
        role
      }
    }
  }
`;
const GET_ME_FOR_CONVERSATIONS = (0, client_1.gql) `
  query GetMeForConversations {
    me { id }
  }
`;
const GET_GROUPS_FOR_CONVERSATIONS = (0, client_1.gql) `
  query GetGroupsForConversations {
    groups {
      id
      name
      type
      avatarUrl
      createdAt
      members {
        id
        user { id username avatarUrl }
        role
      }
    }
  }
`;
const UNREAD_STORAGE_KEY = "yapper:conversation-unread-counts";
function readUnreadCounts() {
    if (typeof window === "undefined")
        return {};
    try {
        const raw = window.localStorage.getItem(UNREAD_STORAGE_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        return Object.fromEntries(Object.entries(parsed)
            .filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value > 0)
            .map(([key, value]) => [key, value]));
    }
    catch (_a) {
        return {};
    }
}
function writeUnreadCounts(counts) {
    if (typeof window === "undefined")
        return;
    const nonZeroCounts = Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
    window.localStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify(nonZeroCounts));
}
function formatTime(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const isSameDay = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();
    const isWithin7Days = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
    if (isSameDay)
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isYesterday)
        return "Yesterday";
    if (isWithin7Days)
        return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { day: "numeric", month: "numeric" });
}
function useConversations(activeConversationId) {
    var _a;
    const { data: meData } = (0, react_1.useQuery)(GET_ME_FOR_CONVERSATIONS);
    const { data, loading, error, refetch } = (0, react_1.useQuery)(GET_CONVERSATIONS, {
        fetchPolicy: "cache-and-network",
    });
    const { data: groupData, loading: groupsLoading, error: groupsError, refetch: refetchGroups } = (0, react_1.useQuery)(GET_GROUPS_FOR_CONVERSATIONS, {
        fetchPolicy: "cache-and-network",
    });
    const [lastMsgMap, setLastMsgMap] = (0, react_2.useState)(new Map());
    const [unreadCounts, setUnreadCounts] = (0, react_2.useState)({});
    const maxActiveSubscriptions = 50;
    const myId = (_a = meData === null || meData === void 0 ? void 0 : meData.me) === null || _a === void 0 ? void 0 : _a.id;
    const markConversationRead = (conversationId) => {
        setUnreadCounts(prev => {
            if (!prev[conversationId])
                return prev;
            const next = Object.assign({}, prev);
            delete next[conversationId];
            writeUnreadCounts(next);
            return next;
        });
    };
    (0, react_2.useEffect)(() => {
        const timeoutId = window.setTimeout(() => {
            setUnreadCounts(readUnreadCounts());
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);
    (0, react_2.useEffect)(() => {
        if (!activeConversationId)
            return;
        const timeoutId = window.setTimeout(() => {
            markConversationRead(activeConversationId);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [activeConversationId]);
    (0, react_2.useEffect)(() => {
        var _a, _b;
        const rooms = (_a = data === null || data === void 0 ? void 0 : data.conversations) !== null && _a !== void 0 ? _a : [];
        const groups = (_b = groupData === null || groupData === void 0 ? void 0 : groupData.groups) !== null && _b !== void 0 ? _b : [];
        const subscribableConversations = [...rooms, ...groups];
        if (subscribableConversations.length === 0)
            return;
        const socket = (0, socketClient_1.getSocket)();
        const roomsToSubscribe = subscribableConversations.slice(0, maxActiveSubscriptions);
        const roomIds = new Set(roomsToSubscribe.map(room => room.id));
        const joinRooms = () => {
            roomsToSubscribe.forEach(room => socket.emit("joinRoom", room.id));
        };
        const handleMessage = (msg) => {
            var _a, _b;
            const conversationId = (_a = msg.roomId) !== null && _a !== void 0 ? _a : msg.groupId;
            if (!conversationId || !roomIds.has(conversationId))
                return;
            setLastMsgMap(prev => {
                const next = new Map(prev);
                next.set(conversationId, {
                    time: formatTime(msg.createdAt),
                    rawTime: msg.createdAt,
                    preview: msg.ephemeral ? "Encrypted ephemeral message" : "Encrypted message",
                });
                return next;
            });
            if (conversationId !== activeConversationId && ((_b = msg.sender) === null || _b === void 0 ? void 0 : _b.id) !== myId) {
                setUnreadCounts(prev => {
                    var _a;
                    const next = Object.assign(Object.assign({}, prev), { [conversationId]: ((_a = prev[conversationId]) !== null && _a !== void 0 ? _a : 0) + 1 });
                    writeUnreadCounts(next);
                    return next;
                });
            }
        };
        if (socket.connected)
            joinRooms();
        socket.on("connect", joinRooms);
        socket.on("message:new", handleMessage);
        return () => {
            socket.off("connect", joinRooms);
            socket.off("message:new", handleMessage);
            roomsToSubscribe.forEach(room => socket.emit("leaveRoom", room.id));
        };
    }, [data === null || data === void 0 ? void 0 : data.conversations, groupData === null || groupData === void 0 ? void 0 : groupData.groups, activeConversationId, myId]);
    const conversations = (0, react_2.useMemo)(() => {
        var _a, _b;
        const roomConversations = ((_a = data === null || data === void 0 ? void 0 : data.conversations) !== null && _a !== void 0 ? _a : [])
            .map(room => {
            var _a, _b, _c, _d, _e;
            let name = (_a = room.name) !== null && _a !== void 0 ? _a : "Conversation";
            let avatarUrl = null;
            const otherMember = room.members.find(m => m.user.id !== myId);
            if (otherMember && !room.name) {
                name = otherMember.user.username;
                avatarUrl = otherMember.user.avatarUrl;
            }
            if (room.members.length === 1 && !room.name) {
                name = "Room";
            }
            const lastEntry = lastMsgMap.get(room.id);
            return {
                id: room.id,
                name,
                avatarUrl,
                isGroup: false,
                lastMessagePreview: (_b = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.preview) !== null && _b !== void 0 ? _b : "Encrypted message",
                lastMessageTime: (_c = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.time) !== null && _c !== void 0 ? _c : formatTime(room.createdAt),
                unreadCount: (_d = unreadCounts[room.id]) !== null && _d !== void 0 ? _d : 0,
                memberIds: room.members.map(m => m.user.id),
                sortKey: (_e = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.rawTime) !== null && _e !== void 0 ? _e : room.createdAt,
            };
        });
        const groupConversations = ((_b = groupData === null || groupData === void 0 ? void 0 : groupData.groups) !== null && _b !== void 0 ? _b : [])
            .map(group => {
            var _a, _b, _c, _d;
            const lastEntry = lastMsgMap.get(group.id);
            return {
                id: group.id,
                name: group.name,
                avatarUrl: group.avatarUrl,
                isGroup: true,
                lastMessagePreview: (_a = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.preview) !== null && _a !== void 0 ? _a : "Encrypted group message",
                lastMessageTime: (_b = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.time) !== null && _b !== void 0 ? _b : formatTime(group.createdAt),
                unreadCount: (_c = unreadCounts[group.id]) !== null && _c !== void 0 ? _c : 0,
                memberIds: group.members.map(m => m.user.id),
                sortKey: (_d = lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.rawTime) !== null && _d !== void 0 ? _d : group.createdAt,
            };
        });
        return [...roomConversations, ...groupConversations]
            .sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime())
            .map(conversation => ({
            id: conversation.id,
            name: conversation.name,
            avatarUrl: conversation.avatarUrl,
            isGroup: conversation.isGroup,
            lastMessagePreview: conversation.lastMessagePreview,
            lastMessageTime: conversation.lastMessageTime,
            unreadCount: conversation.unreadCount,
            memberIds: conversation.memberIds,
        }));
    }, [data, groupData, myId, lastMsgMap, unreadCounts]);
    const refetchAll = async () => {
        await Promise.all([refetch(), refetchGroups()]);
    };
    return {
        conversations,
        loading: loading || groupsLoading,
        error: error !== null && error !== void 0 ? error : groupsError,
        refetch: refetchAll,
        markConversationRead,
    };
}
