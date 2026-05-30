"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, Video, MoreVertical, Paperclip, Clock, Send, Mic, ChevronLeft, ChevronDown, X } from "lucide-react";
import { ConversationAvatar } from "./ConversationAvatar";
import { ChatAttachment, ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { useChatMessages } from "@/lib/hooks/useChatMessages";
import { useSendMessage } from "@/lib/hooks/useSendMessage";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socketClient";
import debounce from "lodash.debounce";
import { gql } from "@apollo/client";
import client from "@/lib/apollo-client";
import {
  decryptFile,
  decryptMessage,
  getDMRoomKey,
  getOrCreateKeyPair,
  loadRoomKey,
} from "@/lib/e2ee";

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const ATTACHMENT_ACCEPT = [
  "image/*",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
].join(",");
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set(["pdf", "docx", "mp4", "jpg", "jpeg", "png", "gif", "webp"]);
const SUPPORTED_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
]);

const FILE_DOWNLOAD_QUERY = gql`
  query DownloadFile($id: ID!) {
    file(id: $id) {
      id
      encryptedBlob
    }
  }
`;

// Define the shape of a message ready for UI rendering
type DecryptedMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  ephemeral: boolean;
  expiresAt?: string | null;
  attachment?: ChatAttachment | null;
  isPending?: boolean;
  isFailed?: boolean;
};

type DownloadFileData = {
  file: {
    id: string;
    encryptedBlob: string | null;
  } | null;
};

function isSupportedAttachment(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type.startsWith("image/")
    || SUPPORTED_ATTACHMENT_MIME.has(file.type)
    || SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function saveDecryptedAttachment(data: ArrayBuffer, attachment: ChatAttachment) {
  const blob = new Blob([data], { type: attachment.type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface ChatPanelProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar: string | null;
  isGroup: boolean;
  currentUserId: string;
  conversationMembers: Array<{
    user: {
      id: string;
      username: string;
      avatarUrl: string | null;
      publicKey: string | null;
    };
  }>;
  onBack?: () => void;
  headerLoading?: boolean;
  scrollPositions?: React.MutableRefObject<Map<string, number>>;
}

function groupMessagesByDate(messages: DecryptedMessage[]): Array<{
  dateLabel: string
  messages: DecryptedMessage[]
}> {
  const groups: Map<string, DecryptedMessage[]> = new Map()

  for (const msg of messages) {
    const date = new Date(msg.timestamp)
    const now = new Date()
    const diffDays = Math.floor(
      (now.setHours(0,0,0,0) - date.setHours(0,0,0,0)) / 86400000
    )

    let label: string
    if (diffDays === 0)      label = "Today"
    else if (diffDays === 1) label = "Yesterday"
    else if (diffDays < 7)   label = new Date(msg.timestamp)
      .toLocaleDateString("en-GB", { weekday: "long" })
    else                     label = new Date(msg.timestamp)
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: diffDays > 365 ? "numeric" : undefined })

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(msg)
  }

  return Array.from(groups.entries()).map(([dateLabel, messages]) => ({
    dateLabel,
    messages,
  }))
}

function isExpiredEphemeralMessage(message: DecryptedMessage, now: number): boolean {
  return message.ephemeral && !!message.expiresAt && new Date(message.expiresAt).getTime() <= now;
}

export function ChatPanel({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup,
  currentUserId,
  conversationMembers,
  onBack,
  headerLoading,
  scrollPositions,
}: ChatPanelProps) {
  const router = useRouter();
  const socket = getSocket();

  const [inputText, setInputText] = useState("");
  const [ephemeral, setEphemeral] = useState(false);
  const [ttl, setTtl] = useState(300);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { messages, loading, fetchMore, canLoadMore } = useChatMessages(conversationId);
  const { sendMessage, loading: sendLoading } = useSendMessage();

  // Sync hook messages to local state for optimistic updates
  useEffect(() => {
    let cancelled = false;

    async function decryptMessages() {
      let roomKey = await loadRoomKey(conversationId);

      if (!roomKey && conversationMembers.length <= 2 && currentUserId) {
        const { privateKey } = await getOrCreateKeyPair();
        const otherMember = conversationMembers.find((member) => member.user.id !== currentUserId)?.user;
        const peerPublicKey = otherMember?.publicKey ?? conversationMembers[0]?.user.publicKey;

        if (privateKey && peerPublicKey) {
          roomKey = await getDMRoomKey(conversationId, privateKey, peerPublicKey);
        }
      }

      const decrypted = await Promise.all(messages.map(async (msg) => {
        let content = "[Unable to decrypt]";
        let attachment: ChatAttachment | null = null;

        if (roomKey) {
          try {
            content = await decryptMessage(msg.encryptedPayload, roomKey);
          } catch {
            content = "[Unable to decrypt]";
          }

          if (msg.file?.encryptedMetadata) {
            try {
              const metadata = JSON.parse(await decryptMessage(msg.file.encryptedMetadata, roomKey)) as {
                name?: string;
                type?: string;
                size?: number;
              };
              attachment = {
                id: msg.file.id,
                name: metadata.name || "Attachment",
                type: metadata.type || "application/octet-stream",
                size: typeof metadata.size === "number" ? metadata.size : 0,
              };
            } catch {
              attachment = {
                id: msg.file.id,
                name: "Encrypted attachment",
                type: "application/octet-stream",
                size: 0,
              };
            }
          }
        }

        return {
          id: msg.id,
          content,
          senderId: msg.sender.id,
          senderName: msg.sender.username,
          timestamp: msg.createdAt,
          ephemeral: msg.ephemeral,
          expiresAt: msg.expiresAt,
          attachment,
          isPending: false,
          isFailed: false,
        };
      }));

      if (cancelled) return;

      setDecryptedMessages((prev) => {
        const now = Date.now();
        const optimistic = prev.filter(m => (m.isPending || m.isFailed) && !isExpiredEphemeralMessage(m, now));
        const all = [...decrypted, ...optimistic]
          .filter((message) => !isExpiredEphemeralMessage(message, now))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return all;
      });
    }

    decryptMessages().catch(() => {
      if (!cancelled) {
        setDecryptedMessages((prev) => prev.filter(m => m.isPending || m.isFailed));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [messages, conversationId, conversationMembers, currentUserId]);

  useEffect(() => {
    const expiringMessages = decryptedMessages.filter((message) => message.ephemeral && message.expiresAt);
    if (expiringMessages.length === 0) return;

    const nextExpiry = Math.min(...expiringMessages.map((message) => new Date(message.expiresAt!).getTime()));
    const delay = Math.max(nextExpiry - Date.now(), 0);
    const timeoutId = window.setTimeout(() => {
      const now = Date.now();
      setDecryptedMessages((prev) => prev.filter((message) => !isExpiredEphemeralMessage(message, now)));
    }, delay + 50);

    return () => window.clearTimeout(timeoutId);
  }, [decryptedMessages]);

  // Save scroll position on unmount / conversationId change
  useEffect(() => {
    const positions = scrollPositions?.current;
    const container = scrollContainerRef.current;
    return () => {
      if (container && positions) {
        positions.set(conversationId, container.scrollTop);
      }
    }
  }, [conversationId, scrollPositions]);

  // Restore scroll position on mount
  useEffect(() => {
    if (loading || !scrollContainerRef.current) return;
    const saved = scrollPositions?.current.get(conversationId);
    if (saved !== undefined) {
      scrollContainerRef.current.scrollTop = saved;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [conversationId, loading, scrollPositions]);

  // Smart auto-scroll for new messages only
  useEffect(() => {
    if (decryptedMessages.length === 0) return;
    const last = decryptedMessages[decryptedMessages.length - 1];
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    const isMine = last.senderId === currentUserId;
    
    if (isMine || nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (!last.isPending && !last.isFailed) {
      setNewMsgCount(c => c + 1);
    }
  }, [decryptedMessages, currentUserId]);

  // Reset newMsgCount on conversation change
  useEffect(() => {
    setNewMsgCount(0);
  }, [conversationId]);

  // Listen for typing events
  useEffect(() => {
    const handleStart = ({ roomId, userId, username }: { roomId: string; userId: string; username: string }) => {
      if (roomId !== conversationId || userId === currentUserId) return;
      setTypingUsers(prev => new Set(prev).add(username));
    };

    const handleStop = ({ roomId, username }: { roomId: string; username: string }) => {
      if (roomId !== conversationId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    };

    socket.on("typing:start", handleStart);
    socket.on("typing:stop", handleStop);

    return () => {
      socket.off("typing:start", handleStart);
      socket.off("typing:stop", handleStop);
      setTypingUsers(new Set());
    };
  }, [conversationId, currentUserId, socket]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emitTypingStop = useCallback(
    debounce(() => {
      socket.emit("typing:stop", { roomId: conversationId, userId: currentUserId });
    }, 2000),
    [conversationId, currentUserId, socket]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const emitTypingStart = useCallback(
    debounce(() => {
      socket.emit("typing:start", { roomId: conversationId, userId: currentUserId });
    }, 500, { leading: true, trailing: false }),
    [conversationId, currentUserId, socket]
  );

  function handleTyping() {
    emitTypingStart();
    emitTypingStop();
  }

  function handleFileSelect(file: File | null) {
    setAttachmentError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isSupportedAttachment(file)) {
      setAttachmentError("Supported files: images, PDFs, DOCX, and MP4.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("Attachments must be 100 MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (ephemeral) {
      setAttachmentError("Turn off ephemeral mode before attaching a file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
  }

  async function handleDownloadAttachment(attachment: ChatAttachment) {
    setAttachmentError(null);

    try {
      const roomKey = await loadRoomKey(conversationId);
      if (!roomKey) throw new Error("Room key unavailable");

      const { data } = await client.query<DownloadFileData>({
        query: FILE_DOWNLOAD_QUERY,
        variables: { id: attachment.id },
        fetchPolicy: "network-only",
      });

      const encryptedBlob = data?.file?.encryptedBlob;
      if (!encryptedBlob) throw new Error("Attachment not found");

      const encryptedBuffer = base64ToArrayBuffer(encryptedBlob);
      const decryptedBuffer = await decryptFile(encryptedBuffer, roomKey);
      saveDecryptedAttachment(decryptedBuffer, attachment);
    } catch (error) {
      console.error(error);
      setAttachmentError("Could not download this attachment.");
    }
  }

  async function handleSend() {
    if (!inputText.trim() && !selectedFile) return;
    if (selectedFile && ephemeral) {
      setAttachmentError("Turn off ephemeral mode before sending an attachment.");
      return;
    }

    const text = inputText.trim();
    const attachmentFile = selectedFile;
    const sentAt = new Date().toISOString();
    const optimisticId = `optimistic-${Date.now()}`;

    setInputText("");
    setSelectedFile(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Append optimistic bubble
    const optimistic: DecryptedMessage = {
      id: optimisticId,
      content: text || (attachmentFile ? "Attachment" : ""),
      senderId: currentUserId,
      senderName: "You",
      timestamp: sentAt,
      ephemeral,
      expiresAt: ephemeral ? new Date(Date.now() + ttl * 1000).toISOString() : null,
      attachment: attachmentFile
        ? {
            id: optimisticId,
            name: attachmentFile.name,
            type: attachmentFile.type || "application/octet-stream",
            size: attachmentFile.size,
          }
        : null,
      isPending: true,
      isFailed: false,
    };
    
    setDecryptedMessages(prev => [...prev, optimistic]);

    const success = await sendMessage({
      roomId: conversationId,
      plaintext: text,
      ephemeral,
      ttl: ephemeral ? ttl : undefined,
      currentUserId,
      attachment: attachmentFile,
    });

    if (!success) {
      setDecryptedMessages(prev =>
        prev.map(m => m.id === optimisticId ? { ...m, isPending: false, isFailed: true } : m)
      );
      setInputText(text);
      setSelectedFile(attachmentFile);
      return;
    }

    // Success: subscription will deliver the real message.
    setTimeout(() => {
      setDecryptedMessages(prev =>
        prev.filter(m => {
          if (m.id !== optimisticId) return true;
          const realExists = prev.some(other =>
            other.id !== optimisticId &&
            other.senderId === currentUserId &&
            Math.abs(new Date(other.timestamp).getTime() - new Date(sentAt).getTime()) < 5000
          );
          return !realExists;
        })
      );
    }, 500);
  }

  const formatTime = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatExpiresLabel = () => {
    return "Expires soon";
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F8FF] relative">
      <div className="bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm shadow-blue-50/50">
        <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150 md:hidden mr-1" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <ConversationAvatar src={conversationAvatar} name={conversationName} size="md" online={true} />
        <div className="flex-1 min-w-0">
          {headerLoading ? (
            <div className="flex-1 space-y-1.5">
              <div className="bg-[#D6E8F5] animate-pulse rounded h-3.5 w-32" />
              <div className="bg-[#D6E8F5] animate-pulse rounded h-3 w-20" />
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-[#0A0A0A] truncate">{conversationName}</p>
              <p className={`text-xs font-medium transition-colors duration-150 ${
                typingUsers.size > 0 ? "text-[#1ABC9C]" : "text-[#6B7A99]"
              }`}>
                {typingUsers.size > 0
                  ? `${[...typingUsers][0]} is typing...`
                  : isGroup ? "Members" : "Online"
                }
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150" title="Search in chat">
            <Search size={18} />
          </button>
          <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150" title="Video call" onClick={() => router.push('/video')}>
            <Video size={18} />
          </button>
          <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150" title="More">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-[#D6E8F5] scrollbar-track-transparent"
        onScroll={() => {
          const el = scrollContainerRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (atBottom) setNewMsgCount(0);
        }}
      >
        {canLoadMore && (
          <div className="flex justify-center mb-4">
            <button onClick={fetchMore} className="text-xs font-semibold text-[#1ABC9C] bg-[#D0F5EE] px-4 py-1.5 rounded-full hover:bg-[#BAD9F5] transition-colors">
              Load older messages
            </button>
          </div>
        )}

        {loading && decryptedMessages.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="bg-[#D6E8F5] animate-pulse rounded-2xl h-10 w-48" />
              </div>
            ))}
          </div>
        )}

        {groupMessagesByDate(decryptedMessages).map((group) => (
          <React.Fragment key={group.dateLabel}>
            <div className="flex justify-center my-3">
              <span className="bg-[#E1F0FF] text-[#6B7A99] text-xs font-semibold px-3 py-1 rounded-full shadow-sm shadow-blue-100/50">
                {group.dateLabel}
              </span>
            </div>
            {group.messages.map((msg, idx) => {
              const prev = idx > 0 ? group.messages[idx - 1] : null;
              const isConsecutive = !!(prev &&
                prev.senderId === msg.senderId &&
                new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() < 120000);
              
              return (
                <ChatBubble
                  key={msg.id}
                  content={msg.content}
                  isSent={msg.senderId === currentUserId}
                  senderName={isGroup && msg.senderId !== currentUserId ? msg.senderName : undefined}
                  timestamp={formatTime(msg.timestamp)}
                  attachment={msg.attachment}
                  onDownloadAttachment={msg.attachment ? () => handleDownloadAttachment(msg.attachment!) : undefined}
                  ephemeral={msg.ephemeral}
                  expiresLabel={msg.expiresAt ? formatExpiresLabel() : undefined}
                  isConsecutive={isConsecutive}
                  isPending={msg.isPending}
                  isFailed={msg.isFailed}
                />
              );
            })}
          </React.Fragment>
        ))}

        {typingUsers.size > 0 && <TypingIndicator name={[...typingUsers][0]} />}
        <div ref={messagesEndRef} />
      </div>

      {newMsgCount > 0 && (
        <div className="absolute bottom-20 right-4 z-10">
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setNewMsgCount(0);
            }}
            className="bg-white border border-[#D6E8F5] shadow-md rounded-full px-3 py-1.5 text-xs font-bold text-[#0A0A0A] flex items-center gap-1.5 hover:bg-[#E1F0FF] transition-colors duration-150"
          >
            <ChevronDown size={14} className="text-[#1ABC9C]" />
            {newMsgCount} new {newMsgCount === 1 ? "message" : "messages"}
          </button>
        </div>
      )}

      <div className="bg-white border-t border-[#D6E8F5] px-4 py-3 shrink-0">
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#D6E8F5] bg-[#F0F8FF] px-3 py-2">
            <Paperclip size={16} className="shrink-0 text-[#1ABC9C]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#0A0A0A]">{selectedFile.name}</p>
              <p className="text-[10px] font-semibold text-[#6B7A99]">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-lg p-1 text-[#6B7A99] transition-colors hover:bg-[#E1F0FF] hover:text-[#0A0A0A]"
              title="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {attachmentError && (
          <p className="mb-2 px-1 text-xs font-semibold text-[#DC2626]">{attachmentError}</p>
        )}
        <div className="flex items-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150 mb-0.5 shrink-0"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                autoResize(e.target);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message"
              rows={1}
              className="w-full bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] resize-none overflow-hidden focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] min-h-[42px] max-h-[120px]"
              style={{ height: 'auto' }}
            />
          </div>
          <button
            onClick={() => setEphemeral(!ephemeral)}
            title={ephemeral ? "Ephemeral on" : "Ephemeral off"}
            className={`hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150 mb-0.5 shrink-0 relative ${ephemeral ? 'text-[#1ABC9C] bg-[#D0F5EE]' : ''}`}
          >
            <Clock size={20} />
            {ephemeral && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#1ABC9C]" />}
          </button>
          <button
            onClick={handleSend}
            disabled={sendLoading || (!inputText.trim() && !selectedFile)}
            className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors duration-150 shrink-0 w-10 h-10 flex items-center justify-center p-0 disabled:opacity-50"
          >
            {inputText.trim() || selectedFile ? <Send size={18} /> : <Mic size={18} />}
          </button>
        </div>

        {ephemeral && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <span className="text-xs font-semibold text-[#6B7A99]">Auto-delete:</span>
            {[
              { label: "30s", value: 30 },
              { label: "5m", value: 300 },
              { label: "1h", value: 3600 },
              { label: "24h", value: 86400 },
              { label: "7d", value: 604800 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTtl(opt.value)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  ttl === opt.value
                    ? 'bg-[#1ABC9C] text-white'
                    : 'bg-[#E1F0FF] text-[#6B7A99] hover:bg-[#BAD9F5]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
