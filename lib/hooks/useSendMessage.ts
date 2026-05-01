"use client";

import { useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useState } from "react";
import {
  encryptMessage,
  getDMRoomKey,
  getOrCreateKeyPair,
  loadRoomKey,
} from "@/lib/e2ee";
import client from "@/lib/apollo-client";

const SEND_MESSAGE = gql`
  mutation SendMessage($roomId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!, $ttl: Int) {
    sendMessage(roomId: $roomId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl) {
      id
      roomId
      encryptedPayload
      ephemeral
      expiresAt
      createdAt
      sender { id username avatarUrl }
    }
  }
`;

const ME_QUERY = gql`
  query SendMessageMe {
    me { id publicKey }
  }
`;

const CONVERSATION_KEY_QUERY = gql`
  query SendMessageConversationKey($id: ID!) {
    conversation(id: $id) {
      id
      members {
        user { id publicKey }
      }
    }
  }
`;

interface SendMessageParams {
  roomId: string;
  plaintext: string;
  ephemeral: boolean;
  ttl?: number;
  currentUserId: string;
}

type KeyUser = {
  id: string;
  publicKey: string | null;
};

type ConversationKeyData = {
  conversation: {
    id: string;
    members: { user: KeyUser }[];
  } | null;
};

type MeData = {
  me: KeyUser;
};

export function useSendMessage() {
  const [error, setError] = useState<string | null>(null);
  
  const [sendMessageMutation, { loading: mutationLoading }] = useMutation(SEND_MESSAGE);
  
  const [isEncrypting, setIsEncrypting] = useState(false);

  const loading = mutationLoading || isEncrypting;

  const sendMessage = async ({
    roomId,
    plaintext,
    ephemeral,
    ttl,
    currentUserId,
  }: SendMessageParams): Promise<boolean> => {
    setError(null);
    setIsEncrypting(true);
    
    try {
      const [{ data: meData }, { data: conversationData }] = await Promise.all([
        client.query<MeData>({
          query: ME_QUERY,
          fetchPolicy: "network-only",
        }),
        client.query<ConversationKeyData>({
          query: CONVERSATION_KEY_QUERY,
          variables: { id: roomId },
          fetchPolicy: "network-only",
        }),
      ]);

      if (!meData?.me) throw new Error("Not authenticated");

      const room = conversationData?.conversation;
      if (!room) throw new Error("Conversation not found");

      const myId = currentUserId || meData.me.id;
      const { privateKey } = await getOrCreateKeyPair();
      if (!privateKey) throw new Error("Local encryption key is unavailable");

      let roomKey = await loadRoomKey(roomId);

      if (!roomKey && room.members.length <= 2) {
        const otherMember = room.members.find((member) => member.user.id !== myId)?.user;
        const peerPublicKey = otherMember?.publicKey ?? meData.me.publicKey;

        if (!peerPublicKey) {
          throw new Error("The recipient has not published an encryption key yet");
        }

        roomKey = await getDMRoomKey(roomId, privateKey, peerPublicKey);
      }

      if (!roomKey) {
        throw new Error("Room key unavailable. Ask an admin to redeliver the room key.");
      }

      const encryptedPayload = await encryptMessage(plaintext, roomKey);

      await sendMessageMutation({
        variables: {
          roomId,
          encryptedPayload,
          ephemeral,
          ttl,
        },
      });

      return true;
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Room key unavailable. Try refreshing.");
      return false;
    } finally {
      setIsEncrypting(false);
    }
  };

  return { sendMessage, loading, error };
}
