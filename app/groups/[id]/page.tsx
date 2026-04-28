"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Users, Settings, Paperclip, Send, Clock, ArrowLeft } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeletons';
import { MemberPanel } from '@/components/ui/MemberPanel';
import { GroupSettingsPanel } from '@/components/ui/GroupSettingsPanel';
import { useToast } from '@/components/ui/Toast';

const GET_GROUP = gql`
  query GetGroup($id: ID!) {
    group(id: $id) {
      id name avatarUrl type locked createdBy
      members { id username avatarUrl role }
    }
  }
`;

const ME_QUERY = gql`query MeGroupChat { me { id } }`;

const GET_GROUP_MESSAGES = gql`
  query GetGroupMessages($roomId: ID!, $cursor: String, $limit: Int) {
    messages(roomId: $roomId, cursor: $cursor, limit: $limit) {
      id senderId encryptedPayload ephemeral expiresAt createdAt
      sender { id username avatarUrl }
    }
  }
`;

const ON_MESSAGE = gql`
  subscription OnMessage($roomId: ID!) {
    messageReceived(roomId: $roomId) {
      id senderId encryptedPayload ephemeral expiresAt createdAt
      sender { id username avatarUrl }
    }
  }
`;

const SEND_GROUP_MESSAGE = gql`
  mutation SendGroupMessage($roomId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!, $ttl: Int) {
    sendMessage(groupId: $roomId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl) {
      id
    }
  }
`;

export default function GroupChatPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { showToast } = useToast();

  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [ephemeral, setEphemeral] = useState(false);
  const [ttl, setTtl] = useState(86400);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: meData } = useQuery<{ me: { id: string } }>(ME_QUERY);
  const myId = meData?.me?.id;

  const { data: groupData, refetch: refetchGroup } = useQuery<{ group: any }>(GET_GROUP, { variables: { id } });
  const group = groupData?.group;

  const { data: messagesData, subscribeToMore } = useQuery<{ messages: any[] }>(GET_GROUP_MESSAGES, { variables: { roomId: id, limit: 50 } });
  const [sendMessage, { loading: sending }] = useMutation(SEND_GROUP_MESSAGE);

  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: ON_MESSAGE,
      variables: { roomId: id },
      updateQuery: (prev: any, { subscriptionData }: { subscriptionData: any }) => {
        if (!subscriptionData.data) return prev;
        const newMsg = subscriptionData.data.messageReceived;
        if (prev.messages.find((m: any) => m.id === newMsg.id)) return prev;
        return { ...prev, messages: [...prev.messages, newMsg] };
      }
    });
    return () => unsubscribe();
  }, [id, subscribeToMore]);

  const messages = messagesData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      // In a real E2EE app, we would encrypt the payload here.
      // For UI implementation purposes, we'll send it directly as "encryptedPayload"
      await sendMessage({ variables: { roomId: id, encryptedPayload: inputText, ephemeral, ttl: ephemeral ? ttl : null } });
      setInputText('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!group) return <div className="bg-[#F0F8FF] h-screen flex items-center justify-center">Loading...</div>;

  const myMembership = group.members.find((m: any) => m.id === myId);
  const isAdmin = myMembership?.role === 'ADMIN';

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
        {messages.length === 0 ? (
          <div className="text-center text-sm font-medium text-[#6B7A99] my-10">No messages yet. Send one to start the conversation!</div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.senderId === myId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2.5 max-w-xs text-sm font-medium text-[#0A0A0A] ${
                  isMe 
                    ? 'ml-auto bg-[#FFFDF5] border border-[#D6E8F5] rounded-2xl rounded-tr-sm' 
                    : 'mr-auto bg-[#E1F0FF] rounded-2xl rounded-tl-sm'
                }`}>
                  {msg.encryptedPayload}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {!isMe && <span className="text-xs font-medium text-[#6B7A99]">{msg.sender.username}</span>}
                  <span className="text-[10px] font-medium text-[#6B7A99]">
                    {new Date(parseInt(msg.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.ephemeral && (
                    <div className="flex items-center gap-0.5 ml-1 text-[#6B7A99]" title={`Expires at ${new Date(parseInt(msg.expiresAt)).toLocaleString()}`}>
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
        members={group.members}
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
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRefresh={refetchGroup}
      />
    </div>
  );
}
