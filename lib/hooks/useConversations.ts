"use client";

import { useQuery, useSubscription } from "@apollo/client/react";
import { gql } from "@apollo/client";

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

const MESSAGE_RECEIVED_SUB = gql`
  subscription OnAnyMessage {
    messageReceived(roomId: "") {
      id roomId createdAt
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

  // Note: messageReceived subscription requires a specific roomId in the schema.
  // We skip a global subscription for conversations list refresh and rely on polling via refetch.
  // When the ChatPanel's per-room subscription fires, it won't automatically update the sidebar — 
  // that is a V2 improvement (shared state / context). For now, conversations refresh on mount.

  const myId = meData?.me?.id;

  const conversations: Conversation[] = (data?.conversations ?? []).map((room) => {
    let name = room.name ?? "Conversation";
    let avatarUrl: string | null = null;

    // For 1-to-1 DMs, derive name from the other member
    if (room.type === "PERSISTENT" || room.type === "EPHEMERAL") {
      const otherMember = room.members.find((m) => m.user.id !== myId);
      if (otherMember && !room.name) {
        name = otherMember.user.username;
        avatarUrl = otherMember.user.avatarUrl;
      }
    }

    // If there's only 1 member (the current user), use the room name
    if (room.members.length === 1) {
      name = room.name ?? "Room";
    }

    return {
      id: room.id,
      name,
      avatarUrl,
      isGroup: false, // Room type doesn't distinguish groups — groups use the groups query
      lastMessagePreview: "🔒 Encrypted message",
      lastMessageTime: formatTime(room.createdAt),
      unreadCount: 0,
      memberIds: room.members.map((m) => m.user.id),
    };
  });

  return { conversations, loading, error, refetch };
}
