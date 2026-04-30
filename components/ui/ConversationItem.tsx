"use client";

import React from "react";
import { ConversationAvatar } from "./ConversationAvatar";

interface ConversationItemProps {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  isActive: boolean;
  online?: boolean;
  isGroup?: boolean;
  onClick: () => void;
}

export function ConversationItem({
  id,
  name,
  avatarUrl,
  lastMessage,
  lastMessageTime,
  unreadCount,
  isActive,
  online,
  isGroup,
  onClick,
}: ConversationItemProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer mx-1 rounded-xl
        transition-colors duration-150
        ${isActive ? 'bg-[#BAD9F5]' : 'hover:bg-[#E1F0FF]'}`}
    >
      <ConversationAvatar
        src={avatarUrl}
        name={name}
        size="md"
        online={isGroup ? undefined : online}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${
            unreadCount > 0 ? 'font-bold text-[#0A0A0A]' : 'font-semibold text-[#374151]'
          }`}>{name}</span>
          <span className={`text-xs font-medium shrink-0 ml-2 ${
            unreadCount > 0 ? 'text-[#1ABC9C]' : 'text-[#6B7A99]'
          }`}>
            {lastMessageTime}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-xs truncate ${
            unreadCount > 0 ? 'font-semibold text-[#1A1A2E]' : 'font-medium text-[#6B7A99]'
          }`}>
            {lastMessage ?? "No messages yet"}
          </span>
          {unreadCount > 0 && (
            <span className="bg-[#1ABC9C] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ml-2 shrink-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
