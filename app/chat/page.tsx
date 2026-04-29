"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { ChatSidebar } from "@/components/ui/ChatSidebar";
import { ChatPanel } from "@/components/ui/ChatPanel";
import { ChatEmptyState } from "@/components/ui/ChatEmptyState";

const GET_ME = gql`
  query GetMe {
    me { id username }
  }
`;

const GET_CONVERSATION = gql`
  query GetConversation($id: ID!) {
    conversation(id: $id) {
      id name type
      createdBy
      members { id username avatarUrl }
    }
  }
`;

export default function ChatPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const { data: meData } = useQuery<{ me: { id: string, username: string } }>(GET_ME);
  const { data: convData } = useQuery<{ conversation: { id: string, name: string, type: string, createdBy: string, members: { id: string, username: string, avatarUrl: string | null }[] } }>(GET_CONVERSATION, {
    variables: { id: activeId },
    skip: !activeId,
  });

  const currentUserId = meData?.me?.id ?? "";
  const activeConv = convData?.conversation;

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
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
        {activeId && activeConv ? (
          <div className="w-full h-full">
            <ChatPanel
              conversationId={activeId}
              conversationName={activeConv.name ?? "Conversation"}
              conversationAvatar={null}
              isGroup={activeConv.type === "GROUP"}
              creatorId={activeConv.createdBy}
              currentUserId={currentUserId}
              onBack={handleBack}
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
