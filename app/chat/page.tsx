"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useLazyQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";

const MESSAGES_QUERY = gql`
  query Messages($roomId: String!) {
    messages(roomId: $roomId) {
      edges {
        id
        sender { username }
        encryptedPayload
        createdAt
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($roomId: String!, $encryptedPayload: String!) {
    sendMessage(roomId: $roomId, encryptedPayload: $encryptedPayload) {
      id
      sender { username }
      encryptedPayload
      createdAt
    }
  }
`;

export default function ChatPage({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sendMessage] = useMutation(SEND_MESSAGE_MUTATION);
  interface Message {
    id: string;
    sender: { username: string };
    encryptedPayload: string;
    createdAt: string;
  }

  interface MessagesData {
    messages: {
      edges: Message[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  }

  const [fetchMessages, { data }] = useLazyQuery<MessagesData>(MESSAGES_QUERY);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages({ variables: { roomId } });
  }, [roomId]);

  useEffect(() => {
    if (data && data.messages) {
      setMessages(data.messages.edges);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [data]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Encrypt message client-side (stub)
    const encryptedPayload = btoa(input); // Replace with AES-GCM/Web Crypto
    await sendMessage({ variables: { roomId, encryptedPayload } });
    setInput("");
    fetchMessages({ variables: { roomId } });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2">
            <span className="font-semibold text-blue-700">{msg.sender.username}</span>
            <span className="ml-2 text-gray-800">{atob(msg.encryptedPayload)}</span>
            <span className="ml-2 text-xs text-gray-500">{new Date(msg.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="flex p-4 bg-white border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border rounded p-2 mr-2"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Send
        </button>
      </form>
    </div>
  );
}
