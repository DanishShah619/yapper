"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Users, Settings, Paperclip, Send, Clock, ArrowLeft } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { MemberPanel } from '@/components/ui/MemberPanel';
import { GroupSettingsPanel } from '@/components/ui/GroupSettingsPanel';
import { useToast } from '@/components/ui/Toast';
import { decryptMessage, encryptMessage, getGroupRoomKey, WrappedGroupKey } from '@/lib/e2ee';
import { getSocket } from '@/lib/socketClient';

const GET_GROUP = gql`
  query GetGroup($id: ID!) {
    group(id: $id) {
      id name avatarUrl type locked createdBy
      members { id role encryptedKey user { id username avatarUrl publicKey } }
    }
  }
`;

const ME_QUERY = gql`query MeGroupChat { me { id publicKey } }`;

const GET_GROUP_MESSAGES = gql`
  query GetGroupMessages($groupId: ID!, $cursor: String, $limit: Int) {
    messages(groupId: $groupId, cursor: $cursor, limit: $limit) {
      edges {
        id encryptedPayload ephemeral expiresAt createdAt
        sender { id username avatarUrl }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SEND_GROUP_MESSAGE = gql`
  mutation SendGroupMessage($groupId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!, $ttl: Int) {
    sendMessage(groupId: $groupId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl) {
      id
    }
  }
`;

const SUBMIT_GROUP_KEYS = gql`
  mutation SubmitGroupKeys($groupId: ID!, $wrappedKeys: [WrappedKeyInput!]!) {
    submitRotatedGroupKeys(groupId: $groupId, wrappedKeys: $wrappedKeys)
  }
`;

type GroupMemberNode = {
  id: string;
  role: "ADMIN" | "MEMBER";
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    publicKey: string | null;
  };
  encryptedKey: string | null;
};

type GroupNode = {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: string;
  locked: boolean;
  createdBy: string;
  members: GroupMemberNode[];
};

type GroupMessage = {
  id: string;
  roomId?: string | null;
  groupId?: string | null;
  encryptedPayload: string;
  ephemeral: boolean;
  expiresAt: string | null;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  plaintext?: string;
  decryptionFailed?: boolean;
};

type GroupMessagesData = {
  messages: {
    edges: GroupMessage[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

function isExpiredEphemeralMessage(message: GroupMessage, now: number): boolean {
  return message.ephemeral && !!message.expiresAt && new Date(message.expiresAt).getTime() <= now;
}

export default function GroupChatPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { showToast } = useToast();

  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [ephemeral, setEphemeral] = useState(false);
  const [ttl, setTtl] = useState(86400);
  const [realtimeMessages, setRealtimeMessages] = useState<GroupMessage[]>([]);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<GroupMessage[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: meData } = useQuery<{ me: { id: string; publicKey: string | null } }>(ME_QUERY);
  const myId = meData?.me?.id;

  const { data: groupData, refetch: refetchGroup } = useQuery<{ group: GroupNode }>(GET_GROUP, { variables: { id } });
  const group = groupData?.group;

  const { data: messagesData } = useQuery<GroupMessagesData>(GET_GROUP_MESSAGES, { variables: { groupId: id, limit: 50 } });
  const [sendMessage, { loading: sending }] = useMutation(SEND_GROUP_MESSAGE);
  const [submitGroupKeys] = useMutation(SUBMIT_GROUP_KEYS);

  const persistWrappedKeys = useCallback(async (wrappedKeys: WrappedGroupKey[]) => {
    if (wrappedKeys.length === 0) return;
    await submitGroupKeys({ variables: { groupId: id, wrappedKeys } });
    await refetchGroup();
  }, [id, refetchGroup, submitGroupKeys]);

  useEffect(() => {
    if (!group || !myId) return;

    let cancelled = false;

    (async () => {
      try {
        setKeyError(null);
        const { roomKey: resolvedRoomKey, wrappedKeys } = await getGroupRoomKey(
          id,
          group.members,
          myId,
          meData?.me.publicKey,
          { allowInitialize: true }
        );

        if (cancelled) return;

        setRoomKey(resolvedRoomKey);
        await persistWrappedKeys(wrappedKeys);
      } catch (err: unknown) {
        if (cancelled) return;
        setRoomKey(null);
        setKeyError(err instanceof Error ? err.message : 'Failed to load group encryption key');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [group, id, myId, meData?.me.publicKey, persistWrappedKeys]);

  useEffect(() => {
    if (!id) return;

    const socket = getSocket();
    const join = () => {
      if (socket.connected) socket.emit('joinRoom', id);
    };
    const handleMessage = (newMessage: GroupMessage) => {
      if (newMessage.groupId !== id && newMessage.roomId !== id) return;
      setRealtimeMessages((prev) => {
        if (prev.some((message) => message.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('message:new', handleMessage);

    return () => {
      socket.off('connect', join);
      socket.off('message:new', handleMessage);
      if (socket.connected) socket.emit('leaveRoom', id);
    };
  }, [id]);

  const messages = useMemo(() => {
    const byId = new Map<string, GroupMessage>();
    for (const message of messagesData?.messages.edges ?? []) {
      if (!isExpiredEphemeralMessage(message, now)) byId.set(message.id, message);
    }
    for (const message of realtimeMessages) {
      if (!isExpiredEphemeralMessage(message, now)) byId.set(message.id, message);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messagesData?.messages.edges, realtimeMessages, now]);

  useEffect(() => {
    if (!roomKey) return;

    let cancelled = false;

    (async () => {
      const decrypted = await Promise.all(
        messages.map(async (message) => {
          if (message.plaintext) return message;

          try {
            const plaintext = await decryptMessage(message.encryptedPayload, roomKey);
            return { ...message, plaintext, decryptionFailed: false };
          } catch {
            return { ...message, plaintext: '[Decryption failed]', decryptionFailed: true };
          }
        })
      );

      if (!cancelled) setDecryptedMessages(decrypted);
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, roomKey]);

  useEffect(() => {
    const expiringMessages = [
      ...(messagesData?.messages.edges ?? []),
      ...realtimeMessages,
    ].filter((message) => message.ephemeral && message.expiresAt && new Date(message.expiresAt).getTime() > Date.now());

    if (expiringMessages.length === 0) return;

    const nextExpiry = Math.min(...expiringMessages.map((message) => new Date(message.expiresAt!).getTime()));
    const delay = Math.max(nextExpiry - Date.now(), 0);
    const timeoutId = window.setTimeout(() => setNow(Date.now()), delay + 50);

    return () => window.clearTimeout(timeoutId);
  }, [messagesData?.messages.edges, realtimeMessages, now]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !myId || !group) return;
    try {
      let activeRoomKey = roomKey;
      if (!activeRoomKey) {
        const resolved = await getGroupRoomKey(
          id,
          group.members,
          myId,
          meData?.me.publicKey,
          { allowInitialize: true }
        );
        activeRoomKey = resolved.roomKey;
        setRoomKey(activeRoomKey);
        await persistWrappedKeys(resolved.wrappedKeys);
      }

      const plaintext = inputText.trim();
      const encryptedPayload = await encryptMessage(plaintext, activeRoomKey);
      await sendMessage({ variables: { groupId: id, encryptedPayload, ephemeral, ttl: ephemeral ? ttl : null } });
      setInputText('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send message', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!group) return <div className="bg-[#F0F8FF] h-screen flex items-center justify-center">Loading...</div>;

  const myMembership = group.members.find((m) => m.user.id === myId);
  const isAdmin = myMembership?.role === 'ADMIN';
  const displayedMessages = roomKey && decryptedMessages.length === messages.length ? decryptedMessages : messages;
  const memberPanelMembers = group.members.map((member) => ({
    id: member.user.id,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
    role: member.role,
  }));

  return (
    <div className="flex flex-col h-screen bg-[#F0F8FF] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center gap-3 shrink-0 relative z-10">
        <button onClick={() => router.push('/groups')} className="mr-1 p-2 rounded-lg hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <Avatar src={group.avatarUrl} name={group.name} size="sm" />
        <div className="flex-1">
          <p className="text-sm font-bold text-[#0A0A0A]">{group.name}</p>
          <p className="text-xs font-medium text-[#6B7A99]">{group.members.length} members</p>
        </div>
        <button onClick={() => setMemberPanelOpen(true)} className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors">
          <Users size={20} />
        </button>
        {isAdmin && (
          <button onClick={() => setSettingsOpen(true)} className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 transition-colors">
            <Settings size={20} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {keyError ? (
          <div className="text-center text-sm font-medium text-red-500 my-10">{keyError}</div>
        ) : displayedMessages.length === 0 ? (
          <div className="text-center text-sm font-medium text-[#6B7A99] my-10">No messages yet. Send one to start the conversation!</div>
        ) : (
          displayedMessages.map((msg) => {
            const isMe = msg.sender.id === myId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2.5 max-w-xs text-sm font-medium text-[#0A0A0A] ${
                  isMe 
                    ? 'ml-auto bg-[#FFFDF5] border border-[#D6E8F5] rounded-2xl rounded-tr-sm' 
                    : 'mr-auto bg-[#E1F0FF] rounded-2xl rounded-tl-sm'
                } ${msg.decryptionFailed ? 'opacity-60' : ''}`}>
                  <p className="break-words whitespace-pre-wrap">{msg.plaintext ?? 'Decrypting...'}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {!isMe && <span className="text-xs font-medium text-[#6B7A99]">{msg.sender.username}</span>}
                  <span className="text-[10px] font-medium text-[#6B7A99]">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.ephemeral && (
                    <div className="flex items-center gap-0.5 ml-1 text-[#6B7A99]" title={msg.expiresAt ? `Expires at ${new Date(msg.expiresAt).toLocaleString()}` : 'Ephemeral'}>
                      <Clock size={10} />
                      <span className="text-[10px] font-medium">Eph</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-[#D6E8F5] px-4 py-3 shrink-0 z-10 relative">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 mb-0.5 transition-colors">
            <Paperclip size={20} />
          </button>
          
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              className="w-full bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] resize-none overflow-hidden"
              placeholder="Type a message..."
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEphemeral(!ephemeral)}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  ephemeral ? 'bg-[#D0F5EE] border-[#1ABC9C] text-[#0A7A65]' : 'bg-[#F0F8FF] border-[#D6E8F5] text-[#6B7A99]'
                }`}
              >
                {ephemeral ? 'Ephemeral ON' : 'Ephemeral OFF'}
              </button>
              
              {ephemeral && (
                <select 
                  className="text-xs font-semibold rounded-full px-3 py-1.5 border bg-[#F0F8FF] border-[#D6E8F5] text-[#1A3A6B] focus:outline-none focus:border-[#BAD9F5]"
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                >
                  <option value={3600}>1 Hour</option>
                  <option value={86400}>1 Day</option>
                  <option value={604800}>1 Week</option>
                </select>
              )}
            </div>
          </div>
          
          <button 
            className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-full p-2.5 mb-0.5 transition-colors disabled:opacity-50"
            disabled={!inputText.trim() || sending}
            onClick={handleSend}
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </div>
      </div>

      <MemberPanel 
        groupId={id}
        members={memberPanelMembers}
        isAdmin={isAdmin}
        currentUserId={myId}
        open={memberPanelOpen}
        onClose={() => setMemberPanelOpen(false)}
        onRefresh={refetchGroup}
      />

      <GroupSettingsPanel
        group={group}
        isAdmin={isAdmin}
        currentUserId={myId}
        currentUserPublicKey={meData?.me.publicKey}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRefresh={refetchGroup}
      />
    </div>
  );
}
