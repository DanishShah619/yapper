"use client";

import { useQuery, useApolloClient } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useState, useRef, useEffect, useMemo } from "react";

// conversations returns [Room!]! — Room has id, name, type, locked, members, createdAt
// Room does NOT have a messages sub-field in the schema, so we fetch conversations separately
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

// We get "me" to identify which member is the current user in DMs
const GET_ME_FOR_CONVERSATIONS = gql`
  query GetMeForConversations {
    me { id }
  }
`;

const MESSAGE_RECEIVED_SUB_SINGLE = gql`
  subscription OnRoomMessage($roomId: ID!) {
    messageReceived(roomId: $roomId) {
      id createdAt ephemeral
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

export interface Conversation {
  id: string;
  name: string;
  avatarUrl: string | null;
  isGroup: boolean;
  lastMessagePreview: string;
  lastMessageTime: string;
  unreadCount: number;
  memberIds: string[];
  _sortKey?: string;
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

export function useConversations() {
  const { data: meData } = useQuery<{ me: { id: string } }>(GET_ME_FOR_CONVERSATIONS);
  const { data, loading, error, refetch } = useQuery<{ conversations: RoomNode[] }>(GET_CONVERSATIONS, {
    fetchPolicy: "cache-and-network",
  });

  const apolloClient = useApolloClient();
  const [updateTick, setUpdateTick] = useState(0);
  const lastMsgMap = useRef<Map<string, {
    time: string;       // formatted display string
    preview: string;    // "🔒 Encrypted message" or "🔒 Ephemeral message"
    rawTime: string;    // ISO string for sorting
  }>>(new Map());

  const MAX_ACTIVE_SUBSCRIPTIONS = 50;  // prevent browser WS limit exhaustion

  useEffect(() => {
    const rooms = data?.conversations ?? [];
    if (rooms.length === 0) return;

    // Cap subscriptions to the 50 most recently active rooms
    const roomsToSubscribe = rooms.slice(0, MAX_ACTIVE_SUBSCRIPTIONS);

    const subscriptions = roomsToSubscribe.map(room =>
      apolloClient.subscribe<{ messageReceived: { id: string; createdAt: string; ephemeral: boolean } }>({
        query: MESSAGE_RECEIVED_SUB_SINGLE,
        variables: { roomId: room.id },
      }).subscribe({
        next({ data: subData }) {
          const msg = subData?.messageReceived;
          if (!msg) return;
          lastMsgMap.current.set(room.id, {
            time: formatTime(msg.createdAt),
            rawTime: msg.createdAt,
            preview: msg.ephemeral ? "🔒 Ephemeral message" : "🔒 Encrypted message",
          });
          setUpdateTick(t => t + 1);
        },
        error(err) {
          console.error(`[NexChat] Subscription error for room ${room.id}:`, err);
        },
      })
    );

    // Cleanup: unsubscribe all when conversations list changes or component unmounts
    return () => subscriptions.forEach(s => s.unsubscribe());
  }, [data?.conversations?.length, apolloClient]);

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

        const lastEntry = lastMsgMap.current.get(room.id);

        return {
          id: room.id,
          name,
          avatarUrl,
          isGroup: false,
          lastMessagePreview: lastEntry?.preview ?? "🔒 Encrypted message",
          lastMessageTime: lastEntry?.time ?? formatTime(room.createdAt),
          unreadCount: 0,
          memberIds: room.members.map(m => m.user.id),
          _sortKey: lastEntry?.rawTime ?? room.createdAt,  // internal only
        };
      })
      .sort((a, b) =>
        new Date(b._sortKey!).getTime() - new Date(a._sortKey!).getTime()
      )
      .map(({ _sortKey, ...rest }) => rest);  // strip internal field before returning
  }, [data, myId, updateTick]);

  return { conversations, loading, error, refetch };
}
