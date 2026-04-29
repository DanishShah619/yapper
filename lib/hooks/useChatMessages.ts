"use client";

import { useQuery, useSubscription } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useEffect, useState } from "react";

// messages() returns MessageConnection { edges: [Message!]!, pageInfo: PageInfo! }
const GET_MESSAGES = gql`
  query GetMessages($roomId: ID, $cursor: String, $limit: Int) {
    messages(roomId: $roomId, cursor: $cursor, limit: $limit) {
      edges {
        id
        roomId
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

const MESSAGE_SUB = gql`
  subscription OnRoomMessage($roomId: ID!) {
    messageReceived(roomId: $roomId) {
      id roomId encryptedPayload ephemeral expiresAt createdAt
      sender { id username avatarUrl }
    }
  }
`;

type MessageNode = {
  id: string;
  roomId: string | null;
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

type MessageReceivedData = {
  messageReceived: MessageNode;
};

export function useChatMessages(roomId: string | null) {
  const [messages, setMessages] = useState<MessageNode[]>([]);

  const { data, loading, error, fetchMore: apolloFetchMore } = useQuery<GetMessagesData>(GET_MESSAGES, {
    variables: { roomId, limit: 50 },
    skip: !roomId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (data?.messages?.edges) {
      const sorted = [...data.messages.edges].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(sorted);
    }
  }, [data]);

  useSubscription<MessageReceivedData>(MESSAGE_SUB, {
    variables: { roomId },
    skip: !roomId,
    onData: ({ data: subData }) => {
      const newMessage = subData.data?.messageReceived;
      if (newMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    },
  });

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
        setMessages((prev) => [...olderMessages, ...prev]);
      }
    } catch (e) {
      console.error("Error fetching more messages", e);
    }
  };

  return { messages, loading, error, fetchMore, canLoadMore };
}
