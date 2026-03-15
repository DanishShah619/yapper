'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Lock,
  MessageSquare,
  ChevronRight,
  LogOut,
} from 'lucide-react';

const GROUPS_QUERY = gql`
  query Groups {
    groups {
      id
      name
      type
      avatarUrl
      locked
      memberAddPolicy
      createdAt
      members {
        id
        role
        user {
          id
          username
          avatarUrl
        }
      }
    }
  }
`;

const CREATE_GROUP_MUTATION = gql`
  mutation CreateGroup($name: String!, $type: RoomType!, $avatar: String) {
    createGroup(name: $name, type: $type, avatar: $avatar) {
      id
      name
      type
      locked
      createdAt
      members {
        id
        role
        user {
          id
          username
        }
      }
    }
  }
`;

const ME_QUERY = gql`
  query Me {
    me { id email username avatarUrl }
  }
`;

interface GroupMember {
  id: string;
  role: string;
  user: { id: string; username: string; avatarUrl?: string | null };
}

interface Group {
  id: string;
  name: string;
  type: 'PERSISTENT' | 'EPHEMERAL';
  avatarUrl?: string | null;
  locked: boolean;
  memberAddPolicy: string;
  createdAt: string;
  members: GroupMember[];
}

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (group: Group) => void;
}

function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PERSISTENT' | 'EPHEMERAL'>('PERSISTENT');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');

  const [createGroup, { loading }] = useMutation(CREATE_GROUP_MUTATION, {
    onCompleted: (data) => {
      onCreated(data.createGroup);
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }
    createGroup({
      variables: { name: name.trim(), type, avatar: avatar.trim() || undefined },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="bg-white rounded-2xl shadow-xl shadow-blue-100/40 p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[#0A0A0A] mb-6">Create New Group</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-[#0A0A0A] mb-1.5">
              Group Name <span className="text-[#1ABC9C]">*</span>
            </label>
            <input
              id="group-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Team"
              maxLength={80}
              className="w-full bg-[#F5F9FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] transition-all"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-bold text-[#0A0A0A] mb-1.5">
              Group Type
            </label>
            <div className="flex gap-3">
              {(['PERSISTENT', 'EPHEMERAL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                    type === t
                      ? 'bg-[#D0F5EE] border-[#1ABC9C] text-[#0A7A65]'
                      : 'bg-[#F5F9FF] border-[#D6E8F5] text-[#6B7A99] hover:bg-[#E1F0FF]'
                  }`}
                >
                  {t === 'PERSISTENT' ? '📁 Persistent' : '⏳ Ephemeral'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-medium text-[#6B7A99]">
              {type === 'PERSISTENT'
                ? 'Messages are stored and accessible to members.'
                : 'Messages auto-delete — no history stored.'}
            </p>
          </div>

          {/* Avatar URL (optional) */}
          <div>
            <label className="block text-sm font-bold text-[#0A0A0A] mb-1.5">
              Avatar URL <span className="text-[#6B7A99] font-medium">(optional)</span>
            </label>
            <input
              id="group-avatar-input"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full bg-[#F5F9FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF] transition-all"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#D6E8F5] bg-[#F5F9FF] text-sm font-semibold text-[#6B7A99] hover:bg-[#E1F0FF] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              id="create-group-submit"
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#1ABC9C] hover:bg-[#17a589] text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('nexchat_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, [router]);

  const { data: meData } = useQuery(ME_QUERY, { skip: !token });
  const { data, loading, refetch } = useQuery<{ groups: Group[] }>(GROUPS_QUERY, {
    skip: !token,
  });

  const groups = data?.groups ?? [];
  const me = meData?.me;

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const getMyRole = (group: Group) =>
    group.members.find((m) => m.user.id === me?.id)?.role ?? 'MEMBER';

  if (!token || loading) {
    return (
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#BAD9F5] border-t-[#1ABC9C] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F8FF]">
      {/* Header */}
      <header className="bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-blue-100/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF] transition-all duration-200"
          >
            <LogOut size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1ABC9C] to-[#2563EB] flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <h1 className="text-base font-bold text-[#0A0A0A]">Groups</h1>
          </div>
        </div>
        <button
          id="create-group-button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1ABC9C] hover:bg-[#17a589] text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm"
        >
          <Plus size={16} />
          New Group
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 bg-[#E1F0FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-[#6B7A99]" />
            </div>
            <h2 className="text-xl font-bold text-[#0A0A0A] mb-2">No groups yet</h2>
            <p className="text-sm font-medium text-[#6B7A99] mb-6">
              Create a group to start messaging with multiple connections at once.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1ABC9C] hover:bg-[#17a589] text-white text-sm font-semibold rounded-xl transition-all duration-200"
            >
              <Plus size={16} />
              Create your first group
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#6B7A99] uppercase tracking-widest px-1 mb-4">
              {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </p>
            {groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  id={`group-item-${group.id}`}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="w-full bg-white border border-[#D6E8F5] rounded-2xl px-4 py-4 flex items-center gap-4 hover:bg-[#F5F9FF] hover:border-[#BAD9F5] hover:shadow-sm hover:shadow-blue-100/40 transition-all duration-200 group"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#BAD9F5] to-[#E1F0FF] flex items-center justify-center text-lg font-bold text-[#2563EB] overflow-hidden">
                    {group.avatarUrl ? (
                      <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitial(group.name)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0A0A0A] truncate">{group.name}</span>
                      {group.locked && (
                        <Lock size={12} className="text-[#6B7A99] flex-shrink-0" />
                      )}
                      {group.type === 'EPHEMERAL' && (
                        <span className="text-xs font-semibold text-[#0A7A65] bg-[#D0F5EE] px-2 py-0.5 rounded-full flex-shrink-0">
                          Ephemeral
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#6B7A99] mt-0.5">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'} · {getMyRole(group) === 'ADMIN' ? '👑 Admin' : 'Member'}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 text-[#6B7A99] group-hover:text-[#0A0A0A] transition-colors">
                    <MessageSquare size={16} />
                    <ChevronRight size={16} />
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showModal && (
          <CreateGroupModal
            onClose={() => setShowModal(false)}
            onCreated={() => { refetch(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
