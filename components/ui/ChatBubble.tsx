"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCheck, Clock, Download, FileText, ImageIcon, Pencil, Trash2, Video } from "lucide-react";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
};

interface ChatBubbleProps {
  content: string;
  isSent: boolean;
  senderName?: string;
  timestamp: string;
  attachment?: ChatAttachment | null;
  onDownloadAttachment?: () => void;
  canModify?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  edited?: boolean;
  deleted?: boolean;
  ephemeral?: boolean;
  expiresLabel?: string;
  isConsecutive?: boolean;
  isPending?: boolean;
  isFailed?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <ImageIcon size={18} />;
  if (type === "video/mp4") return <Video size={18} />;
  return <FileText size={18} />;
}

function renderLinkedContent(content: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  return content.split(urlPattern).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;

    return (
      <a
        key={`${part}-${index}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#0A7A65] underline decoration-[#1ABC9C]/50 underline-offset-2 break-all hover:text-[#075E50]"
      >
        {part}
      </a>
    );
  });
}

export function ChatBubble({
  content,
  isSent,
  senderName,
  timestamp,
  attachment,
  onDownloadAttachment,
  canModify,
  onEdit,
  onDelete,
  edited,
  deleted,
  ephemeral,
  expiresLabel,
  isConsecutive,
  isPending,
  isFailed,
}: ChatBubbleProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const lastTouchAtRef = useRef(0);
  const canShowActions = !!canModify && !deleted && !isPending && !isFailed;

  const bubbleClass = isSent
    ? `bg-[#FFFDF5] border border-[#D6E8F5] px-4 py-2.5 max-w-[75%] text-sm font-medium text-[#0A0A0A] ${isConsecutive ? 'rounded-2xl' : 'rounded-2xl rounded-tr-sm'}`
    : `bg-[#E1F0FF] px-4 py-2.5 max-w-[75%] text-sm font-medium text-[#0A0A0A] ${isConsecutive ? 'rounded-2xl' : 'rounded-2xl rounded-tl-sm'}`;

  const wrapperClass = `flex flex-col ${isSent ? 'items-end' : 'items-start'} ${isConsecutive ? 'mb-0.5' : 'mb-3'}`;

  useEffect(() => {
    if (!actionMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActionMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuOpen]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    };
  }, []);

  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && !!target.closest("a, button");
  }

  function handleBubbleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!canShowActions || isInteractiveTarget(event.target)) return;
    if (Date.now() - lastTouchAtRef.current < 700) return;

    setActionMenuOpen((open) => !open);
  }

  function handleBubblePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShowActions || isInteractiveTarget(event.target)) return;
    if (event.pointerType !== "touch") return;

    lastTouchAtRef.current = Date.now();
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      setActionMenuOpen(true);
      longPressTimerRef.current = null;
    }, 520);
  }

  function runAction(action?: () => void) {
    setActionMenuOpen(false);
    action?.();
  }

  return (
    <div className={wrapperClass}>
      {!isSent && !isConsecutive && senderName && (
        <span className="text-xs font-semibold text-[#1ABC9C] mb-1 px-1">{senderName}</span>
      )}

      <div ref={actionMenuRef} className={`relative flex w-full ${isSent ? "justify-end" : "justify-start"}`}>
        <div
          className={`${bubbleClass} ${canShowActions ? "cursor-pointer select-none" : ""}`}
          onClick={handleBubbleClick}
          onPointerDown={handleBubblePointerDown}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          aria-haspopup={canShowActions ? "menu" : undefined}
          aria-expanded={canShowActions ? actionMenuOpen : undefined}
        >
          {content && (
            <p className={`leading-relaxed whitespace-pre-wrap ${deleted ? 'italic text-[#6B7A99]' : ''}`}>
              {renderLinkedContent(content)}
            </p>
          )}

          {attachment && !deleted && (
            <button
              type="button"
              onClick={onDownloadAttachment}
              disabled={isPending}
              className={`mt-2 flex w-full min-w-[220px] max-w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                isSent
                  ? "border-[#D6E8F5] bg-white/70 hover:bg-[#E1F0FF]"
                  : "border-[#BAD9F5] bg-white/60 hover:bg-white"
              } disabled:cursor-wait disabled:opacity-60`}
              title="Download attachment"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D0F5EE] text-[#1ABC9C]">
                <AttachmentIcon type={attachment.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[#0A0A0A]">{attachment.name}</span>
                <span className="block text-[10px] font-semibold text-[#6B7A99]">{formatSize(attachment.size)}</span>
              </span>
              <Download size={16} className="shrink-0 text-[#6B7A99]" />
            </button>
          )}

          <div className="flex items-center justify-end gap-1.5 mt-1.5">
            {ephemeral && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#6B7A99]">
                <Clock size={10} /> {expiresLabel}
              </span>
            )}
            {edited && !deleted && (
              <span className="text-[10px] text-[#6B7A99]">edited</span>
            )}
            <span className="text-[10px] text-[#6B7A99]">{timestamp}</span>
            {isSent && (
              isPending
                ? <Clock size={12} className="text-[#9CA3AF]" />
                : <CheckCheck size={12} className="text-[#1ABC9C]" />
            )}
          </div>
        </div>

        {canShowActions && actionMenuOpen && (
          <div
            role="menu"
            className={`absolute bottom-full z-20 mb-1 min-w-32 overflow-hidden rounded-xl border border-[#D6E8F5] bg-white py-1 shadow-lg shadow-slate-200/70 ${
              isSent ? "right-0" : "left-0"
            }`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onEdit)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#E1F0FF]"
            >
              <Pencil size={14} className="text-[#6B7A99]" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onDelete)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
      {isFailed && (
        <span className="text-[10px] text-[#DC2626] font-semibold mt-1 cursor-pointer">
          Failed — tap to retry
        </span>
      )}
    </div>
  );
}
