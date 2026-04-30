import React from "react";
import { CheckCheck, Clock } from "lucide-react";

interface ChatBubbleProps {
  content: string;
  isSent: boolean;
  senderName?: string;
  timestamp: string;
  ephemeral?: boolean;
  expiresLabel?: string;
  isConsecutive?: boolean;
  isPending?: boolean;
  isFailed?: boolean;
}

export function ChatBubble({
  content,
  isSent,
  senderName,
  timestamp,
  ephemeral,
  expiresLabel,
  isConsecutive,
  isPending,
  isFailed,
}: ChatBubbleProps) {
  const bubbleClass = isSent
    ? `bg-[#FFFDF5] border border-[#D6E8F5] px-4 py-2.5 max-w-[65%] text-sm font-medium text-[#0A0A0A] ${isConsecutive ? 'rounded-2xl' : 'rounded-2xl rounded-tr-sm'}`
    : `bg-[#E1F0FF] px-4 py-2.5 max-w-[65%] text-sm font-medium text-[#0A0A0A] ${isConsecutive ? 'rounded-2xl' : 'rounded-2xl rounded-tl-sm'}`;

  const wrapperClass = `flex flex-col ${isSent ? 'items-end' : 'items-start'} ${isConsecutive ? 'mb-0.5' : 'mb-3'}`;

  return (
    <div className={wrapperClass}>
      {!isSent && !isConsecutive && senderName && (
        <span className="text-xs font-semibold text-[#1ABC9C] mb-1 px-1">{senderName}</span>
      )}

      <div className={bubbleClass}>
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>

        <div className="flex items-center justify-end gap-1.5 mt-1.5">
          {ephemeral && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#6B7A99]">
              <Clock size={10} /> {expiresLabel}
            </span>
          )}
          <span className="text-[10px] text-[#6B7A99]">{timestamp}</span>
          {isSent && (
            isPending
              ? <Clock size={12} className="text-[#9CA3AF]" />
              : <CheckCheck size={12} className="text-[#1ABC9C]" />
          )}
        </div>
      </div>
      {isFailed && (
        <span className="text-[10px] text-[#DC2626] font-semibold mt-1 cursor-pointer">
          Failed — tap to retry
        </span>
      )}
    </div>
  );
}
