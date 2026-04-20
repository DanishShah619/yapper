'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Lock, Unlock, Settings, UserPlus, UserMinus,
  ShieldCheck, LogOut, Trash2, Link2, Send, Crown,
  VolumeX, Volume2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getOrCreateGroupKey, encryptMessage, decryptMessage } from '@/lib/e2ee';

// ─── GraphQL ────────────────────────────────────────────────────────────────

const ME_QUERY = gql`query Me { me { id username avatarUrl } }`;

const GROUP_QUERY = gql`
  query Group($id: ID!) {
    group(id: $id) {
      id name type avatarUrl locked memberAddPolicy createdAt
      members {
        id role mutedAt joinedAt
        user { id username avatarUrl }
      }
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($groupId: ID!, $encryptedPayload: String!, $ephemeral: Boolean) {
    sendMessage(groupId: $groupId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral) {
      id groupId sender { id username avatarUrl } encryptedPayload ephemeral expiresAt createdAt
    }
  }
`;

const MESSAGES_QUERY = gql`
  query Messages($groupId: ID!) {
    messages(groupId: $groupId, limit: 100) {
      edges {
        id encryptedPayload ephemeral createdAt
        sender { id username avatarUrl }
      }
    }
  }
`;

const ADD_MEMBER = gql`
  mutation AddGroupMember($groupId: ID!, $username: String!) {
    addGroupMember(groupId: $groupId, username: $username) {
      id role user { id username avatarUrl }
    }
  }
`;

const REMOVE_MEMBER = gql`mutation RemoveGroupMember($groupId: ID!, $userId: ID!) { removeGroupMember(groupId: $groupId, userId: $userId) }`;
const PROMOTE_MEMBER = gql`
  mutation PromoteGroupMember($groupId: ID!, $userId: ID!) {
    promoteGroupMember(groupId: $groupId, userId: $userId) { id role user { id username } }
  }
`;
const MUTE_MEMBER = gql`
  mutation MuteGroupMember($groupId: ID!, $userId: ID!) {
    muteGroupMember(groupId: $groupId, userId: $userId) { id mutedAt user { id username } }
  }
`;
const LEAVE_GROUP = gql`mutation LeaveGroup($groupId: ID!) { leaveGroup(groupId: $groupId) }`;
const LOCK_GROUP = gql`mutation LockGroup($groupId: ID!) { lockGroup(groupId: $groupId) { id locked } }`;
const DELETE_GROUP = gql`mutation DeleteGroup($groupId: ID!) { deleteGroup(groupId: $groupId) }`;
const TRANSFER_OWNERSHIP = gql`mutation TransferGroupOwnership($groupId: ID!, $userId: ID!) { transferGroupOwnership(groupId: $groupId, userId: $userId) { id } }`;
const GENERATE_INVITE = gql`mutation GenerateInviteLink($groupId: ID!, $ttl: Int!) { generateInviteLink(groupId: $groupId, ttl: $ttl) { url expiresAt } }`;
const UPDATE_POLICY = gql`mutation UpdateMemberAddPolicy($groupId: ID!, $policy: MemberAddPolicy!) { updateMemberAddPolicy(groupId: $groupId, policy: $policy) { id memberAddPolicy } }`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupMember {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  mutedAt?: string | null;
  joinedAt: string;
  user: { id: string; username: string; avatarUrl?: string | null };
}

interface Group {
  id: string;
  name: string;
  type: 'PERSISTENT' | 'EPHEMERAL';
  avatarUrl?: string | null;
  locked: boolean;
  memberAddPolicy: 'ADMIN_ONLY' | 'OPEN';
  createdAt: string;
  members: GroupMember[];
}

interface LocalMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  text: string;
  ephemeral: boolean;
  createdAt: string;
  decryptionFailed?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitial = (name: string) => name.charAt(0).toUpperCase();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── Component ───────────────────────────────────────────────────────────────

export default function GroupChatPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [ephemeral, setEphemeral] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [settingsTab, setSettingsTab] = useState<'members' | 'admin'>('members');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize group key
  useEffect(() => {
    if (!groupId) return;
    getOrCreateGroupKey(groupId).then(setGroupKey).catch(e => console.error('E2E Key Error', e));
  }, [groupId]);

  useEffect(() => {
    const t = localStorage.getItem('nexchat_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, [router]);

  const { data: meData } = useQuery<{ me: any }>(ME_QUERY, { skip: !token });
  const { data, loading, refetch } = useQuery<{ group: Group }>(GROUP_QUERY, {
    variables: { id: groupId },
    skip: !token || !groupId,
  });

  const { data: msgData, refetch: refetchMessages } = useQuery<{ messages: { edges: any[] } }>(MESSAGES_QUERY, {
    variables: { groupId },
    skip: !token || !groupId || !groupKey,
    pollInterval: 3000,
  });

  // Decrypt incoming messages
  useEffect(() => {
    if (!msgData?.messages?.edges || !groupKey) return;
    
    (async () => {
      const decrypted = await Promise.all(
        msgData.messages.edges.map(async (m: any) => {
          try {
            const text = await decryptMessage(m.encryptedPayload, groupKey);
            return {
              id: m.id,
              senderId: m.sender.id,
              senderUsername: m.sender.username,
              text,
              ephemeral: m.ephemeral,
              createdAt: m.createdAt,
              decryptionFailed: false
            };
          } catch (e) {
            return {
              id: m.id,
              senderId: m.sender.id,
              senderUsername: m.sender.username,
              text: '[Decryption failed]',
              ephemeral: m.ephemeral,
              createdAt: m.createdAt,
              decryptionFailed: true
            };
          }
        })
      );
      setMessages(decrypted);
    })();
  }, [msgData, groupKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const group = data?.group;
  const me = meData?.me;
  const myMembership = group?.members.find((m) => m.user.id === me?.id);
  const isAdmin = myMembership?.role === 'ADMIN';

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE, {
    onCompleted: () => refetchMessages(),
    onError: (e) => console.error(e),
  });

  const [addMember] = useMutation(ADD_MEMBER, {
    onCompleted: () => { setAddSuccess('Member added!'); setAddUsername(''); refetch(); },
    onError: (e) => setAddError(e.message),
  });

  const [removeMember] = useMutation(REMOVE_MEMBER, { onCompleted: () => refetch() });
  const [promoteMember] = useMutation(PROMOTE_MEMBER, { onCompleted: () => refetch() });
  const [muteMember] = useMutation(MUTE_MEMBER, { onCompleted: () => refetch() });
  const [leaveGroup] = useMutation(LEAVE_GROUP, {
    onCompleted: () => router.push('/groups'),
    onError: (e) => alert(e.message),
  });
  const [lockGroup] = useMutation(LOCK_GROUP, { onCompleted: () => refetch() });
  const [deleteGroup] = useMutation(DELETE_GROUP, {
    onCompleted: () => router.push('/groups'),
    onError: (e) => alert(e.message),
  });
  const [transferOwnership] = useMutation(TRANSFER_OWNERSHIP, {
    onCompleted: () => { alert('Ownership transferred'); refetch(); },
    onError: (e) => alert(e.message),
  });
  const [generateInvite] = useMutation(GENERATE_INVITE, {
    onCompleted: (res: any) => setInviteUrl(window.location.origin + res.generateInviteLink.url),
    onError: (e) => alert(e.message),
  });
  const [updatePolicy] = useMutation(UPDATE_POLICY, { onCompleted: () => refetch() });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !groupKey || !me) return;
    const payload = input.trim();
    setInput('');
    try {
      const encryptedPayload = await encryptMessage(payload, groupKey);
      
      // Optimistic locally
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          senderId: me.id,
          senderUsername: me.username,
          text: payload,
          ephemeral,
          createdAt: new Date().toISOString(),
        },
      ]);

      await sendMessage({ variables: { groupId, encryptedPayload, ephemeral } });
    } catch (e: any) {
      alert(`Encryption failed: ${e.message}`);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    if (!addUsername.trim()) return;
    addMember({ variables: { groupId, username: addUsername.trim() } });
  };

  if (!token || loading) {
    return (
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#BAD9F5] border-t-[#1ABC9C] rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-[#6B7A99] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#0A0A0A]">Group not found</p>
          <button onClick={() => router.push('/groups')} className="mt-3 text-sm text-[#2563EB] font-semibold hover:underline">
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F0F8FF] overflow-hidden">
      {/* ── Chat Column ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Chat Header */}
        <div className="bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/groups')}
              className="p-2 rounded-xl text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF] transition-all duration-200"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#BAD9F5] to-[#E1F0FF] flex items-center justify-center text-base font-bold text-[#2563EB]">
              {group.avatarUrl
                ? <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover rounded-xl" />
                : getInitial(group.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0A0A0A]">{group.name}</h1>
                {group.locked && <Lock size={13} className="text-[#6B7A99]" />}
                {group.type === 'EPHEMERAL' && (
                  <span className="text-xs font-semibold text-[#0A7A65] bg-[#D0F5EE] px-2 py-0.5 rounded-full">
                    Ephemeral
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-[#6B7A99]">
                {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
          <button
            id="group-settings-toggle"
            onClick={() => setShowSettings((s) => !s)}
            className={`p-2 rounded-xl transition-all duration-200 ${showSettings ? 'bg-[#BAD9F5] text-[#0A0A0A]' : 'text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF]'}`}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Ephemeral Banner */}
        {group.type === 'EPHEMERAL' && (
          <div className="bg-[#D0F5EE] border-b border-[#1ABC9C]/20 px-4 py-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-[#0A7A65] flex-shrink-0" />
            <p className="text-xs font-semibold text-[#0A7A65]">
              Ephemeral group — all messages auto-delete. No history is stored.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare size={32} className="text-[#BAD9F5] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#6B7A99]">No messages yet — say hello!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.senderId === me?.id;
            const memberInfo = group.members.find((m) => m.user.id === msg.senderId);
            const isAdminMsg = memberInfo?.role === 'ADMIN';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#BAD9F5] to-[#E1F0FF] flex items-center justify-center text-xs font-bold text-[#2563EB] flex-shrink-0">
                    {getInitial(msg.senderUsername)}
                  </div>
                )}
                <div className={`max-w-xs ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMine && (
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-xs font-bold text-[#0A0A0A]">{msg.senderUsername}</span>
                      {isAdminMsg && <Crown size={10} className="text-[#1ABC9C]" />}
                    </div>
                  )}
                  <div
                    className={`px-4 py-2.5 text-sm font-medium ${
                      isMine
                        ? 'bg-[#FFFDF5] text-[#0A0A0A] rounded-2xl rounded-tr-sm border border-[#D6E8F5]'
                        : 'bg-[#E1F0FF] text-[#1A1A2E] rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 px-1">
                    {msg.ephemeral && (
                      <span className="text-xs text-[#6B7A99]">⏱</span>
                    )}
                    <span className="text-xs font-medium text-[#6B7A99]">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="bg-white border-t border-[#D6E8F5] px-4 py-3 flex items-center gap-3 flex-shrink-0"
        >
          <button
            type="button"
            onClick={() => setEphemeral((e) => !e)}
            title="Toggle ephemeral"
            className={`flex-shrink-0 px-3 py-2 rounded-full border text-xs font-semibold transition-all duration-200 ${
              ephemeral
                ? 'bg-[#D0F5EE] border-[#1ABC9C] text-[#0A7A65]'
                : 'bg-[#F0F8FF] border-[#D6E8F5] text-[#6B7A99] hover:bg-[#E1F0FF]'
            }`}
          >
            ⏱
          </button>
          <input
            id="group-message-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ephemeral ? 'Ephemeral message…' : 'Message…'}
            className="flex-1 bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] transition-all"
          />
          <button
            id="group-send-button"
            type="submit"
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 bg-[#1ABC9C] hover:bg-[#17a589] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all duration-200"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* ── Settings Panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex-shrink-0 bg-white border-l border-[#D6E8F5] overflow-y-auto overflow-x-hidden"
          >
            <div className="p-4 min-w-[320px]">
              {/* Panel Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#0A0A0A]">Group Info</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-lg text-[#6B7A99] hover:bg-[#E1F0FF] transition-all"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="flex bg-[#F5F9FF] rounded-xl p-1 mb-4">
                {(['members', 'admin'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 capitalize ${
                      settingsTab === tab
                        ? 'bg-white text-[#0A0A0A] shadow-sm'
                        : 'text-[#6B7A99] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {tab === 'members' ? <><Users size={12} className="inline mr-1" />Members</> : <><ShieldCheck size={12} className="inline mr-1" />Admin</>}
                  </button>
                ))}
              </div>

              {/* Members Tab */}
              {settingsTab === 'members' && (
                <div className="space-y-2">
                  {group.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F9FF] group">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#BAD9F5] to-[#E1F0FF] flex items-center justify-center text-xs font-bold text-[#2563EB] flex-shrink-0">
                        {getInitial(m.user.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#0A0A0A] truncate">{m.user.username}</span>
                          {m.role === 'ADMIN' && <Crown size={11} className="text-[#1ABC9C] flex-shrink-0" />}
                          {m.mutedAt && <VolumeX size={11} className="text-[#6B7A99] flex-shrink-0" />}
                        </div>
                        <p className="text-xs font-medium text-[#6B7A99]">{m.role === 'ADMIN' ? 'Admin' : 'Member'}</p>
                      </div>
                      {/* Admin action buttons */}
                      {isAdmin && m.user.id !== me?.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {m.role === 'MEMBER' && (
                            <button
                              title="Promote to Admin"
                              onClick={() => promoteMember({ variables: { groupId, userId: m.user.id } })}
                              className="p-1.5 rounded-lg text-[#6B7A99] hover:text-[#1ABC9C] hover:bg-[#D0F5EE] transition-all"
                            >
                              <ShieldCheck size={13} />
                            </button>
                          )}
                          <button
                            title={m.mutedAt ? 'Unmute' : 'Mute'}
                            onClick={() => muteMember({ variables: { groupId, userId: m.user.id } })}
                            className="p-1.5 rounded-lg text-[#6B7A99] hover:text-[#2563EB] hover:bg-[#E1F0FF] transition-all"
                          >
                            {m.mutedAt ? <Volume2 size={13} /> : <VolumeX size={13} />}
                          </button>
                          <button
                            title="Remove member"
                            onClick={() => {
                              if (confirm(`Remove ${m.user.username} from the group?`)) {
                                removeMember({ variables: { groupId, userId: m.user.id } });
                              }
                            }}
                            className="p-1.5 rounded-lg text-[#6B7A99] hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <UserMinus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Admin Tab */}
              {settingsTab === 'admin' && (
                <div className="space-y-4">
                  {/* Add member */}
                  {(isAdmin || group.memberAddPolicy === 'OPEN') && (
                    <div>
                      <label className="block text-xs font-bold text-[#0A0A0A] mb-2">Add Member</label>
                      <form onSubmit={handleAddMember} className="flex gap-2">
                        <input
                          id="add-member-input"
                          type="text"
                          value={addUsername}
                          onChange={(e) => { setAddUsername(e.target.value); setAddError(''); setAddSuccess(''); }}
                          placeholder="username"
                          className="flex-1 bg-[#F5F9FF] border border-[#D6E8F5] rounded-xl px-3 py-2 text-xs font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-1 focus:ring-[#E1F0FF] transition-all"
                        />
                        <button
                          id="add-member-submit"
                          type="submit"
                          className="px-3 py-2 bg-[#1ABC9C] hover:bg-[#17a589] text-white text-xs font-semibold rounded-xl transition-all flex-shrink-0"
                        >
                          <UserPlus size={14} />
                        </button>
                      </form>
                      {addError && <p className="text-xs text-red-500 font-medium mt-1">{addError}</p>}
                      {addSuccess && <p className="text-xs text-[#1ABC9C] font-semibold mt-1">{addSuccess}</p>}
                    </div>
                  )}

                  {/* Invite Link (admin only) */}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-bold text-[#0A0A0A] mb-2">Invite Link</label>
                      <div className="space-y-2">
                        <button
                          id="generate-invite-link"
                          onClick={() => generateInvite({ variables: { groupId, ttl: 86400 } })} // 24hr TTL
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#F5F9FF] hover:bg-[#E1F0FF] border border-[#D6E8F5] rounded-xl text-xs font-semibold text-[#0A0A0A] transition-all"
                        >
                          <Link2 size={13} className="text-[#6B7A99]" />
                          Generate 24hr invite link
                        </button>
                        {inviteUrl && (
                          <div className="flex items-center gap-2 bg-[#D0F5EE] border border-[#1ABC9C]/20 rounded-xl px-3 py-2">
                            <span className="text-xs font-medium text-[#0A7A65] truncate flex-1">{inviteUrl}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(inviteUrl); }}
                              className="text-xs font-bold text-[#1ABC9C] hover:underline flex-shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Member Add Policy (admin only) */}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-bold text-[#0A0A0A] mb-2">Who can add members?</label>
                      <div className="flex gap-2">
                        {(['ADMIN_ONLY', 'OPEN'] as const).map((policy) => (
                          <button
                            key={policy}
                            onClick={() => updatePolicy({ variables: { groupId, policy } })}
                            className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 ${
                              group.memberAddPolicy === policy
                                ? 'bg-[#D0F5EE] border-[#1ABC9C] text-[#0A7A65]'
                                : 'bg-[#F5F9FF] border-[#D6E8F5] text-[#6B7A99] hover:bg-[#E1F0FF]'
                            }`}
                          >
                            {policy === 'ADMIN_ONLY' ? '👑 Admins only' : '🌐 Open'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lock Group (admin only) */}
                  {isAdmin && !group.locked && (
                    <button
                      id="lock-group-button"
                      onClick={() => { if (confirm('Lock this group? No new members can join.')) lockGroup({ variables: { groupId } }); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border border-[#D6E8F5] rounded-xl text-xs font-semibold text-[#0A0A0A] hover:bg-[#E1F0FF] transition-all"
                    >
                      <Lock size={13} className="text-[#6B7A99]" />
                      Lock group (prevent new members)
                    </button>
                  )}
                  {isAdmin && group.locked && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                      <Lock size={13} className="text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700">Group is locked</span>
                    </div>
                  )}

                  {/* Transfer Ownership (admin only) */}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-bold text-[#0A0A0A] mb-2">Transfer Ownership</label>
                      <div className="space-y-1">
                        {group.members
                          .filter((m) => m.user.id !== me?.id)
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (confirm(`Transfer ownership to ${m.user.username}? You'll become a member.`)) {
                                  transferOwnership({ variables: { groupId, userId: m.user.id } });
                                }
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F9FF] hover:bg-[#E1F0FF] border border-[#D6E8F5] rounded-xl text-xs font-medium text-[#0A0A0A] transition-all"
                            >
                              <Crown size={12} className="text-[#1ABC9C]" />
                              Transfer to @{m.user.username}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-[#D6E8F5] pt-4 space-y-2">
                    {/* Leave Group */}
                    <button
                      id="leave-group-button"
                      onClick={() => { if (confirm('Leave this group?')) leaveGroup({ variables: { groupId } }); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border border-[#D6E8F5] rounded-xl text-xs font-semibold text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF] transition-all"
                    >
                      <LogOut size={13} />
                      Leave group
                    </button>

                    {/* Delete Group (admin only) */}
                    {isAdmin && (
                      <button
                        id="delete-group-button"
                        onClick={() => { if (confirm('Delete this group permanently? This cannot be undone.')) deleteGroup({ variables: { groupId } }); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 border border-red-100 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={13} />
                        Delete group
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Named import for icon used in empty state inside messages div
function MessageSquare({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
