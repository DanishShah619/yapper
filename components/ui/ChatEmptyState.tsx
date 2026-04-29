import React from "react";
import { MessageSquare, Lock } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#F0F8FF]">
      <div className="relative mb-8">
        <div className="w-40 h-40 rounded-full bg-[#E1F0FF] flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-[#BAD9F5] flex items-center justify-center">
            <MessageSquare size={40} className="text-[#1ABC9C]" />
          </div>
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#D0F5EE]" />
        <div className="absolute -bottom-2 -left-3 w-6 h-6 rounded-full bg-[#BAD9F5]" />
      </div>

      <h2 className="text-xl font-bold text-[#0A0A0A] mb-2">NexChat</h2>
      <p className="text-sm font-medium text-[#6B7A99] text-center max-w-xs">
        Select a conversation to start messaging, or search for someone new.
      </p>
      <p className="text-xs font-medium text-[#6B7A99] mt-4 flex items-center gap-1.5">
        <Lock size={11} /> End-to-end encrypted
      </p>
    </div>
  );
}
