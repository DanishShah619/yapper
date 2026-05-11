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

type MessageNode = {
  id: string;
  roomId: string | null;
  groupId: string | null;
  encryptedPayload: string;
  ephemeral: boolean;
  expiresAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  sender: { id: string; username: string; avatarUrl: string | null };
  file: {
    id: string;
    encryptedMetadata: string;
    createdAt: string;
    uploader: { id: string; username: string; avatarUrl: string | null };
  } | null;
};

type GetMessagesData = {
  messages: {
    edges: MessageNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

function isExpiredEphemeral(msg: MessageNode, now: number): boolean {
  return msg.ephemeral && !!msg.expiresAt && new Date(msg.expiresAt).getTime() <= now;
}

export function useChatMessages(roomId: string | null) {
  const [realtimeMessages, setRealtimeMessages] = useState<MessageNode[]>([]);
  const [fetchedOlderMessages, setFetchedOlderMessages] = useState<MessageNode[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const { data, loading, error, fetchMore: apolloFetchMore } = useQuery<GetMessagesData>(GET_MESSAGES, {
    variables: { roomId, limit: 50 },
    skip: !roomId,
    fetchPolicy: "network-only",
  });

  const messages = useMemo(() => {
    const byId = new Map<string, MessageNode>();
    const belongsToRoom = (msg: MessageNode) => msg.roomId === roomId || msg.groupId === roomId;

    for (const msg of fetchedOlderMessages) {
      if (belongsToRoom(msg) && !isExpiredEphemeral(msg, now)) byId.set(msg.id, msg);
    }
    for (const msg of data?.messages?.edges ?? []) {
      if (!isExpiredEphemeral(msg, now)) byId.set(msg.id, msg);
    }
    for (const msg of realtimeMessages) {
      if (belongsToRoom(msg) && !isExpiredEphemeral(msg, now)) byId.set(msg.id, msg);
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [data?.messages?.edges, fetchedOlderMessages, realtimeMessages, roomId, now]);

  useEffect(() => {
    const expiringMessages = [
      ...fetchedOlderMessages,
      ...(data?.messages?.edges ?? []),
      ...realtimeMessages,
    ].filter((msg) => msg.ephemeral && msg.expiresAt && new Date(msg.expiresAt).getTime() > Date.now());

    if (expiringMessages.length === 0) return;

    const nextExpiry = Math.min(...expiringMessages.map((msg) => new Date(msg.expiresAt!).getTime()));
    const delay = Math.max(nextExpiry - Date.now(), 0);
    const timeoutId = window.setTimeout(() => setNow(Date.now()), delay + 50);

    return () => window.clearTimeout(timeoutId);
  }, [data?.messages?.edges, fetchedOlderMessages, realtimeMessages, now]);

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    const join = () => {
      if (socket.connected) socket.emit("joinRoom", roomId);
    };
    const handleMessage = (newMessage: MessageNode) => {
      if (newMessage.roomId !== roomId && newMessage.groupId !== roomId) return;
      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    };
    const handleMessageUpdate = (updatedMessage: MessageNode) => {
      if (updatedMessage.roomId !== roomId && updatedMessage.groupId !== roomId) return;
      setRealtimeMessages((prev) => {
        const withoutUpdated = prev.filter((message) => message.id !== updatedMessage.id);
        return [...withoutUpdated, updatedMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    };

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("message:new", handleMessage);
    socket.on("message:updated", handleMessageUpdate);
    socket.on("message:deleted", handleMessageUpdate);

    return () => {
      socket.off("connect", join);
      socket.off("message:new", handleMessage);
      socket.off("message:updated", handleMessageUpdate);
      socket.off("message:deleted", handleMessageUpdate);
      if (socket.connected) socket.emit("leaveRoom", roomId);
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
        setFetchedOlderMessages((prev) => [...olderMessages, ...prev].filter((msg) => !isExpiredEphemeral(msg, Date.now())));
      }
    } catch (e) {
      console.error("Error fetching more messages", e);
    }
  };

  return { messages, loading, error, fetchMore, canLoadMore };
}
