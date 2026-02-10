"use client";

import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socketClient";

const GET_CONVERSATIONS = gql`
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

const GET_ME_FOR_CONVERSATIONS = gql`
  query GetMeForConversations {
    me { id }
  }
`;

const GET_GROUPS_FOR_CONVERSATIONS = gql`
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

type RoomMemberNode = {
  id: string;
  user: { id: string; username: string; avatarUrl: string | null };
  role: string;
};

type RoomNode = {
  id: string;
  name: string | null;
  type: string;
  createdAt: string;
  members: RoomMemberNode[];
};

type GroupNode = {
  id: string;
  name: string;
  type: string;
  avatarUrl: string | null;
  createdAt: string;
  members: RoomMemberNode[];
};

type MessageEvent = {
  id: string;
  roomId: string | null;
  groupId: string | null;
  createdAt: string;
  ephemeral: boolean;
  sender?: { id: string };
};

export interface Conversation {
  id: string;
  name: string;
  avatarUrl: string | null;
  isGroup: boolean;
  lastMessagePreview: string;
  lastMessageTime: string;
  unreadCount: number;
  memberIds: string[];
}

type SortableConversation = Conversation & { sortKey: string };
const UNREAD_STORAGE_KEY = "yapper:conversation-unread-counts";

function readUnreadCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(UNREAD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value > 0)
        .map(([key, value]) => [key, value as number])
    );
  } catch {
    return {};
  }
}

function writeUnreadCounts(counts: Record<string, number>) {
  if (typeof window === "undefined") return;

  const nonZeroCounts = Object.fromEntries(
    Object.entries(counts).filter(([, count]) => count > 0)
  );
  window.localStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify(nonZeroCounts));
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const isWithin7Days = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;

  if (isSameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return "Yesterday";
  if (isWithin7Days) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "numeric" });
}

export function useConversations(activeConversationId?: string | null) {
  const { data: meData } = useQuery<{ me: { id: string } }>(GET_ME_FOR_CONVERSATIONS);
  const { data, loading, error, refetch } = useQuery<{ conversations: RoomNode[] }>(GET_CONVERSATIONS, {
    fetchPolicy: "cache-and-network",
  });
  const { data: groupData, loading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery<{ groups: GroupNode[] }>(GET_GROUPS_FOR_CONVERSATIONS, {
    fetchPolicy: "cache-and-network",
  });

  const [lastMsgMap, setLastMsgMap] = useState<Map<string, {
    time: string;
    preview: string;
    rawTime: string;
  }>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const maxActiveSubscriptions = 50;
  const myId = meData?.me?.id;

  const markConversationRead = (conversationId: string) => {
    setUnreadCounts(prev => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      writeUnreadCounts(next);
      return next;
    });
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUnreadCounts(readUnreadCounts());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;

    const timeoutId = window.setTimeout(() => {
      markConversationRead(activeConversationId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeConversationId]);

  useEffect(() => {
    const rooms = data?.conversations ?? [];
    const groups = groupData?.groups ?? [];
    const subscribableConversations = [...rooms, ...groups];
    if (subscribableConversations.length === 0) return;

    const socket = getSocket();
    const roomsToSubscribe = subscribableConversations.slice(0, maxActiveSubscriptions);
    const roomIds = new Set(roomsToSubscribe.map(room => room.id));

    const joinRooms = () => {
      roomsToSubscribe.forEach(room => socket.emit("joinRoom", room.id));
    };

    const handleMessage = (msg: MessageEvent) => {
      const conversationId = msg.roomId ?? msg.groupId;
      if (!conversationId || !roomIds.has(conversationId)) return;

      setLastMsgMap(prev => {
        const next = new Map(prev);
        next.set(conversationId, {
          time: formatTime(msg.createdAt),
          rawTime: msg.createdAt,
          preview: msg.ephemeral ? "Encrypted ephemeral message" : "Encrypted message",
        });
        return next;
      });

      if (conversationId !== activeConversationId && msg.sender?.id !== myId) {
        setUnreadCounts(prev => {
          const next = {
            ...prev,
            [conversationId]: (prev[conversationId] ?? 0) + 1,
          };
          writeUnreadCounts(next);
          return next;
        });
      }
    };

    if (socket.connected) joinRooms();
    socket.on("connect", joinRooms);
    socket.on("message:new", handleMessage);

    return () => {
      socket.off("connect", joinRooms);
      socket.off("message:new", handleMessage);
      roomsToSubscribe.forEach(room => socket.emit("leaveRoom", room.id));
    };
  }, [data?.conversations, groupData?.groups, activeConversationId, myId]);

  const conversations: Conversation[] = useMemo(() => {
    const roomConversations = (data?.conversations ?? [])
      .map(room => {
        let name = room.name ?? "Conversation";
        let avatarUrl: string | null = null;

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
          lastMessagePreview: lastEntry?.preview ?? "Encrypted message",
          lastMessageTime: lastEntry?.time ?? formatTime(room.createdAt),
          unreadCount: unreadCounts[room.id] ?? 0,
          memberIds: room.members.map(m => m.user.id),
          sortKey: lastEntry?.rawTime ?? room.createdAt,
        } satisfies SortableConversation;
      });

    const groupConversations = (groupData?.groups ?? [])
      .map(group => {
        const lastEntry = lastMsgMap.get(group.id);

        return {
          id: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl,
          isGroup: true,
          lastMessagePreview: lastEntry?.preview ?? "Encrypted group message",
          lastMessageTime: lastEntry?.time ?? formatTime(group.createdAt),
          unreadCount: unreadCounts[group.id] ?? 0,
          memberIds: group.members.map(m => m.user.id),
          sortKey: lastEntry?.rawTime ?? group.createdAt,
        } satisfies SortableConversation;
      });

    return [...roomConversations, ...groupConversations]
      .sort((a, b) =>
        new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
      )
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
    error: error ?? groupsError,
    refetch: refetchAll,
    markConversationRead,
  };
}
