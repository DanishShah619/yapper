"use client";

import { useState, Suspense, useRef } from "react";
import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { ChatSidebar } from "@/components/ui/ChatSidebar";
import { ChatPanel } from "@/components/ui/ChatPanel";
import { ChatEmptyState } from "@/components/ui/ChatEmptyState";
import { useRouter, useSearchParams } from "next/navigation";

const GET_ME = gql`
  query GetMe {
    me { id username }
  }
`;

const GET_CONVERSATION = gql`
  query GetConversation($id: ID!) {
    conversation(id: $id) {
      id name type
      members {
        user { id username avatarUrl publicKey }
      }
    }
  }
`;

type ConversationMember = {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    publicKey: string | null;
  };
};

type ConversationData = {
  conversation: {
    id: string;
    name: string | null;
    type: string;
    members: ConversationMember[];
  } | null;
};

function ChatPageInner() {
  const [showSidebar, setShowSidebar] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("room");

  // Keep track of scroll positions for chats
  const scrollPositions = useRef<Map<string, number>>(new Map());

  const { data: meData } = useQuery<{ me: { id: string, username: string } }>(GET_ME);
  const { data: convData, loading: convLoading } = useQuery<ConversationData>(GET_CONVERSATION, {
    variables: { id: activeId },
    skip: !activeId,
  });

  const currentUserId = meData?.me?.id ?? "";
  const activeConv = convData?.conversation;

  const handleSelectConversation = (id: string) => {
    router.replace(`/chat?room=${id}`, { scroll: false });
    setShowSidebar(false);
  };

  const handleBack = () => {
    setShowSidebar(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F8FF]">
      {/* Left Sidebar */}
      <div className={`
        ${showSidebar ? 'flex' : 'hidden'}
        md:flex w-full md:w-80 h-full shrink-0
      `}>
        <div className="w-full">
          <ChatSidebar
            activeConversationId={activeId}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </div>

      {/* Right Panel */}
      <div className={`
        ${!showSidebar || activeId ? 'flex' : 'hidden'}
        md:flex flex-1 h-full overflow-hidden
      `}>
        {activeId ? (
          <div className="w-full h-full">
            <ChatPanel
              conversationId={activeId}
              conversationName={activeConv?.name ?? "Conversation"}
              conversationAvatar={null}
              isGroup={false}
              currentUserId={currentUserId}
              conversationMembers={activeConv?.members ?? []}
              onBack={handleBack}
              headerLoading={convLoading}
              scrollPositions={scrollPositions}
            />
          </div>
        ) : (
          <div className="w-full h-full hidden md:block">
            <ChatEmptyState />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#F0F8FF] items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
