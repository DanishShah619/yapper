"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Video, MoreVertical, Paperclip, Clock, Send, Mic, ChevronLeft } from "lucide-react";
import { ConversationAvatar } from "./ConversationAvatar";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { useChatMessages } from "@/lib/hooks/useChatMessages";
import { useSendMessage } from "@/lib/hooks/useSendMessage";
import { useRouter } from "next/navigation";

interface ChatPanelProps {
  conversationId: string;
  conversationName: string;
  conversationAvatar: string | null;
  isGroup: boolean;
  creatorId: string;
  currentUserId: string;
  onBack?: () => void;
}

export function ChatPanel({
  conversationId,
  conversationName,
  conversationAvatar,
  isGroup,
  creatorId,
  currentUserId,
  onBack,
}: ChatPanelProps) {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [ephemeral, setEphemeral] = useState(false);
  const [ttl, setTtl] = useState(300);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserName, setTyping] = useState("");
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, loading, fetchMore, canLoadMore } = useChatMessages(conversationId);
  const { sendMessage, loading: sendLoading } = useSendMessage();

  // Decryption simulation — messages use sender.id (not senderId)
  const decryptedMessages = messages.map((msg) => {
    let content = msg.encryptedPayload;
    if (content.startsWith("[ENCRYPTED] ")) {
      content = content.replace("[ENCRYPTED] ", "");
    } else {
      content = "[Unable to decrypt]";
    }
    return { ...msg, content };
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages.length]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleTyping() {
    // emit typing indicator via Socket.IO
  }

  async function handleSend() {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const success = await sendMessage({
      roomId: conversationId,
      plaintext: text,
      ephemeral,
      ttl: ephemeral ? ttl : undefined,
      currentUserId,
      creatorId,
    });

    if (!success) {
      setInputText(text);
    }
  }

  const formatTime = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatExpiresLabel = (isoDate: string) => {
    // In a real app, calculate the relative time to expiration
    return "Expires soon";
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F8FF]">
      <div className="bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm shadow-blue-50/50">
        <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150 md:hidden mr-1" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <ConversationAvatar src={conversationAvatar} name={conversationName} size="md" online={true} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0A0A0A] truncate">{conversationName}</p>
          <p className="text-xs font-medium text-[#6B7A99]">
            {isGroup ? `Members` : "Online"}
          </p>
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-[#D6E8F5] scrollbar-track-transparent">
        {canLoadMore && (
          <div className="flex justify-center mb-4">
            <button onClick={fetchMore} className="text-xs font-semibold text-[#1ABC9C] bg-[#D0F5EE] px-4 py-1.5 rounded-full hover:bg-[#BAD9F5] transition-colors">
              Load older messages
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="bg-[#D6E8F5] animate-pulse rounded-2xl h-10 w-48" />
              </div>
            ))}
          </div>
        )}

        {decryptedMessages.map((msg) => (
          <ChatBubble
            key={msg.id}
            content={msg.content}
            isSent={msg.sender.id === currentUserId}
            senderName={isGroup && msg.sender.id !== currentUserId ? msg.sender.username : undefined}
            timestamp={formatTime(msg.createdAt)}
            ephemeral={msg.ephemeral}
            expiresLabel={msg.expiresAt ? formatExpiresLabel(msg.expiresAt) : undefined}
          />
        ))}

        {isTyping && <TypingIndicator name={typingUserName} />}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-[#D6E8F5] px-4 py-3 shrink-0">
        <div className="flex items-end gap-3">
          <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors duration-150 mb-0.5 shrink-0" title="Attach file">
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
            disabled={!inputText.trim() && !sendLoading}
            className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-xl px-4 py-2 text-sm transition-colors duration-150 shrink-0 w-10 h-10 flex items-center justify-center p-0 disabled:opacity-50"
          >
            {inputText.trim() ? <Send size={18} /> : <Mic size={18} />}
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
