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

type MessageEvent = {
  id: string;
  roomId: string | null;
  groupId: string | null;
  createdAt: string;
  ephemeral: boolean;
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

export function useConversations() {
  const { data: meData } = useQuery<{ me: { id: string } }>(GET_ME_FOR_CONVERSATIONS);
  const { data, loading, error, refetch } = useQuery<{ conversations: RoomNode[] }>(GET_CONVERSATIONS, {
    fetchPolicy: "cache-and-network",
  });

  const [lastMsgMap, setLastMsgMap] = useState<Map<string, {
    time: string;
    preview: string;
    rawTime: string;
  }>>(new Map());

  const maxActiveSubscriptions = 50;

  useEffect(() => {
    const rooms = data?.conversations ?? [];
    if (rooms.length === 0) return;

    const socket = getSocket();
    const roomsToSubscribe = rooms.slice(0, maxActiveSubscriptions);
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
    };

    if (socket.connected) joinRooms();
    socket.on("connect", joinRooms);
    socket.on("message:new", handleMessage);

    return () => {
      socket.off("connect", joinRooms);
      socket.off("message:new", handleMessage);
      roomsToSubscribe.forEach(room => socket.emit("leaveRoom", room.id));
    };
  }, [data?.conversations]);

  const myId = meData?.me?.id;

  const conversations: Conversation[] = useMemo(() => {
    return (data?.conversations ?? [])
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
          unreadCount: 0,
          memberIds: room.members.map(m => m.user.id),
          sortKey: lastEntry?.rawTime ?? room.createdAt,
        } satisfies SortableConversation;
      })
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
  }, [data, myId, lastMsgMap]);

  return { conversations, loading, error, refetch };
}
