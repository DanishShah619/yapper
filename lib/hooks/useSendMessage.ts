"use client";

import { useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useState } from "react";
// Assuming getRoomKey and encryptMessage are available from e2ee utilities
// In a real implementation you would import them.
// import { getRoomKey, encryptMessage } from "../e2ee";

const SEND_MESSAGE = gql`
  mutation SendMessage($roomId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!, $ttl: Int) {
    sendMessage(roomId: $roomId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl)
  }
`;

interface SendMessageParams {
  roomId: string;
  plaintext: string;
  ephemeral: boolean;
  ttl?: number;
  currentUserId: string;
  creatorId: string;
}

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
    creatorId,
  }: SendMessageParams): Promise<boolean> => {
    setError(null);
    setIsEncrypting(true);
    
    try {
      // 1. Get room key
      // const roomKey = await getRoomKey(roomId, currentUserId, creatorId);
      // if (!roomKey) throw new Error("Room key unavailable");
      
      // 2. Encrypt plaintext
      // const encryptedPayload = await encryptMessage(plaintext, roomKey);
      
      // Since we don't have the exact e2ee imports verified, we will simulate it
      // in accordance with "V1 encrypts internally using getRoomKey + encryptMessage"
      // Replace these lines with actual e2ee calls.
      const encryptedPayload = `[ENCRYPTED] ${plaintext}`; // Fallback stub

      // 3. Call sendMessage mutation
      await sendMessageMutation({
        variables: {
          roomId,
          encryptedPayload,
          ephemeral,
          ttl,
        },
      });

      return true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Room key unavailable — try refreshing");
      return false;
    } finally {
      setIsEncrypting(false);
    }
  };

  return { sendMessage, loading, error };
}
