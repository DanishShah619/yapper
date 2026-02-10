"use client";

import React, { useState } from "react";
import { Search, SquarePen, MoreVertical, MessageSquare, Users } from "lucide-react";
import { useConversations } from "@/lib/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";
import { useQuery, useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useToast } from "./Toast";
import { useRouter } from "next/navigation";

type ConnectionNode = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

const GET_CONNECTIONS = gql`
  query GetConnections {
    connections {
      id
      username
      avatarUrl
    }
  }
`;

const CREATE_DM = gql`
  mutation CreateDM($username: String!) {
    createDM(username: $username) {
      id
    }
  }
`;

interface ChatSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

export function ChatSidebar({ activeConversationId, onSelectConversation }: ChatSidebarProps) {
  const { conversations, loading, markConversationRead } = useConversations(activeConversationId);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const { showToast } = useToast();
  const router = useRouter();

  const { data: connData, loading: connLoading } = useQuery<{ connections: ConnectionNode[] }>(GET_CONNECTIONS, {
    skip: activeTab !== "Connections",
  });

  const [createDM] = useMutation<{ createDM: { id: string } }, { username: string }>(CREATE_DM, {
    onCompleted: (data) => {
      if (data?.createDM) {
        onSelectConversation(data.createDM.id);
      }
    },
    onError: (err) => {
      showToast(err.message, "error");
    }
  });

  const filteredConversations = conversations
    .filter((c) => {
      if (searchQuery) return c.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "Unread") return c.unreadCount > 0;
      if (activeTab === "Groups") return c.isGroup;
      return true; // "All"
    })

  const connections = connData?.connections || [];
  const filteredConnections = connections.filter((c) => {
    if (searchQuery) return c.username.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const handleConnectionClick = (username: string) => {
    createDM({ variables: { username } });
  };

  const handleConversationClick = (id: string, isGroup: boolean) => {
    markConversationRead(id);

    if (isGroup) {
      router.push(`/groups/${id}`);
      return;
    }

    onSelectConversation(id);
  };

  return (
    <aside className="w-80 h-full bg-[#F5F9FF] border-r border-[#D6E8F5] flex flex-col shrink-0">
      <div className="px-4 pt-4 pb-3 border-b border-[#D6E8F5]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-[#0A0A0A]">NexChat</h1>
          <div className="flex items-center gap-1">
            <button 
              className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150" 
              title="New Chat"
              onClick={() => setActiveTab("Connections")}
            >
              <SquarePen size={18} />
            </button>
            <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150" title="Menu">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A99]" />
          <input
            type="text"
            placeholder={activeTab === "Connections" ? "Search connections" : "Search or start new chat"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-[#D6E8F5] rounded-xl pl-9 pr-4 py-2 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[#D6E8F5] overflow-x-auto scrollbar-none">
        {["All", "Unread", "Groups", "Connections"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors duration-150 shrink-0 ${
              activeTab === tab
                ? 'bg-[#1ABC9C] text-white'
                : 'bg-[#E1F0FF] text-[#6B7A99] hover:bg-[#BAD9F5] hover:text-[#0A0A0A]'
            }`}
          >
            {tab}
            {tab === "Unread" && totalUnread > 0 && (
              <span className="ml-1.5 bg-white text-[#1ABC9C] text-[10px] font-bold rounded-full px-1">
                {totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[#D6E8F5] scrollbar-track-transparent">
        {/* Loading State */}
        {((loading && activeTab !== "Connections") || (connLoading && activeTab === "Connections")) && (
          <div className="space-y-1 px-2 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
                <div className="bg-[#D6E8F5] animate-pulse rounded-full w-10 h-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="bg-[#D6E8F5] animate-pulse rounded h-3 w-28" />
                  <div className="bg-[#D6E8F5] animate-pulse rounded h-3 w-40" />
                </div>
                <div className="bg-[#D6E8F5] animate-pulse rounded h-3 w-8" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State Conversations */}
        {!loading && activeTab !== "Connections" && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare size={32} className="text-[#BAD9F5] mb-3" />
            <p className="text-sm font-bold text-[#0A0A0A]">No conversations</p>
            <p className="text-xs font-medium text-[#6B7A99] mt-1">
              {searchQuery ? "No results for that search" : "Start a conversation from Connections"}
            </p>
          </div>
        )}

        {/* Conversations List */}
        {!loading && activeTab !== "Connections" &&
          filteredConversations.map((convo) => (
            <ConversationItem
              key={convo.id}
              {...convo}
              lastMessage={convo.lastMessagePreview}
              isActive={convo.id === activeConversationId}
              onClick={() => handleConversationClick(convo.id, convo.isGroup)}
            />
          ))}

        {/* Empty State Connections */}
        {!connLoading && activeTab === "Connections" && filteredConnections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Users size={32} className="text-[#BAD9F5] mb-3" />
            <p className="text-sm font-bold text-[#0A0A0A]">No connections</p>
            <p className="text-xs font-medium text-[#6B7A99] mt-1">
              {searchQuery ? "No connections match your search" : "Add some connections to start chatting"}
            </p>
          </div>
        )}

        {/* Connections List */}
        {!connLoading && activeTab === "Connections" &&
          filteredConnections.map((conn) => (
            <ConversationItem
              key={conn.id}
              id={conn.id}
              name={conn.username}
              avatarUrl={conn.avatarUrl}
              lastMessage={null}
              lastMessageTime={null}
              unreadCount={0}
              isActive={false}
              isGroup={false}
              onClick={() => handleConnectionClick(conn.username)}
            />
          ))}
      </div>
    </aside>
  );
}
