import React from "react";
import { CheckCheck, Clock } from "lucide-react";

interface ChatBubbleProps {
  content: string;
  isSent: boolean;
  senderName?: string;
  timestamp: string;
  ephemeral?: boolean;
  expiresLabel?: string;
}

export function ChatBubble({
  content,
  isSent,
  senderName,
  timestamp,
  ephemeral,
  expiresLabel,
}: ChatBubbleProps) {
  return (
    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-1`}>
      {!isSent && senderName && (
        <span className="text-xs font-semibold text-[#1ABC9C] mb-1 px-1">{senderName}</span>
      )}

      <div className={isSent 
        ? "bg-[#FFFDF5] border border-[#D6E8F5] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[65%] text-sm font-medium text-[#0A0A0A]" 
        : "bg-[#E1F0FF] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[65%] text-sm font-medium text-[#0A0A0A]"}>
        <p className="leading-relaxed">{content}</p>

        <div className="flex items-center justify-end gap-1.5 mt-1.5">
          {ephemeral && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#6B7A99]">
              <Clock size={10} /> {expiresLabel}
            </span>
          )}
          <span className="text-[10px] text-[#6B7A99]">{timestamp}</span>
          {isSent && <CheckCheck size={12} className="text-[#1ABC9C]" />}
        </div>
      </div>
    </div>
  );
}
