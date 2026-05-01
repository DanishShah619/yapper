"use client";

import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socketClient";

// messages() returns MessageConnection { edges: [Message!]!, pageInfo: PageInfo! }
const GET_MESSAGES = gql`
  query GetMessages($roomId: ID, $cursor: String, $limit: Int) {
    messages(roomId: $roomId, cursor: $cursor, limit: $limit) {
      edges {
        id
        roomId
        groupId
        encryptedPayload
        ephemeral
        expiresAt
        createdAt
        sender { id username avatarUrl }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type MessageNode = {
  id: string;
  roomId: string | null;
  groupId: string | null;
  encryptedPayload: string;
  ephemeral: boolean;
  expiresAt: string | null;
  createdAt: string;
  sender: { id: string; username: string; avatarUrl: string | null };
};

type GetMessagesData = {
  messages: {
    edges: MessageNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export function useChatMessages(roomId: string | null) {
  const [realtimeMessages, setRealtimeMessages] = useState<MessageNode[]>([]);
  const [fetchedOlderMessages, setFetchedOlderMessages] = useState<MessageNode[]>([]);

  const { data, loading, error, fetchMore: apolloFetchMore } = useQuery<GetMessagesData>(GET_MESSAGES, {
    variables: { roomId, limit: 50 },
    skip: !roomId,
    fetchPolicy: "network-only",
  });

  const messages = useMemo(() => {
    const byId = new Map<string, MessageNode>();
    const belongsToRoom = (msg: MessageNode) => msg.roomId === roomId || msg.groupId === roomId;

    for (const msg of fetchedOlderMessages) {
      if (belongsToRoom(msg)) byId.set(msg.id, msg);
    }
    for (const msg of data?.messages?.edges ?? []) byId.set(msg.id, msg);
    for (const msg of realtimeMessages) {
      if (belongsToRoom(msg)) byId.set(msg.id, msg);
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [data?.messages?.edges, fetchedOlderMessages, realtimeMessages, roomId]);

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    const join = () => socket.emit("joinRoom", roomId);
    const handleMessage = (newMessage: MessageNode) => {
      if (newMessage.roomId !== roomId && newMessage.groupId !== roomId) return;
      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    };

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("message:new", handleMessage);

    return () => {
      socket.off("connect", join);
      socket.off("message:new", handleMessage);
      socket.emit("leaveRoom", roomId);
    };
  }, [roomId]);

  const canLoadMore = data?.messages?.pageInfo?.hasNextPage ?? false;

  const fetchMore = async () => {
    if (!roomId || !canLoadMore) return;
    const cursor = data?.messages?.pageInfo?.endCursor;
    try {
      const res = await apolloFetchMore({
        variables: { roomId, cursor, limit: 50 },
      });
      if (res.data?.messages?.edges) {
        const olderMessages = [...res.data.messages.edges].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setFetchedOlderMessages((prev) => [...olderMessages, ...prev]);
      }
    } catch (e) {
      console.error("Error fetching more messages", e);
    }
  };

  return { messages, loading, error, fetchMore, canLoadMore };
}
