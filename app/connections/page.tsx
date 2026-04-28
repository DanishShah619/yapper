'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useLazyQuery, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  UserX,
  Check,
  X,
  ArrowLeft,
  Users,
  Clock,
  AlertCircle,
  Loader2,
  MessageSquare,
} from 'lucide-react';

// ─── GraphQL ─────────────────────────────────────────────────────────────────

const ME_QUERY = gql`
  query Me { me { id username avatarUrl } }
`;

const SEARCH_USER = gql`
  query SearchUser($username: String!) {
    user(username: $username) {
      id username avatarUrl createdAt
    }
  }
`;

const CONNECTIONS_QUERY = gql`
  query Connections {
    connections {
      id username avatarUrl createdAt online
    }
  }
`;

const PRESENCE_SUBSCRIPTION = gql`
  subscription PresenceUpdated {
    presenceUpdated {
      userId
      online
    }
  }
`;

const REQUESTS_QUERY = gql`
  query ConnectionRequests {
    connectionRequests {
      id status createdAt
      requester { id username avatarUrl }
      addressee { id username avatarUrl }
    }
  }
`;

const SEND_REQUEST = gql`
  mutation SendConnectionRequest($username: String!) {
    sendConnectionRequest(username: $username) {
      id status createdAt
      requester { id username }
      addressee { id username }
    }
  }
`;

const RESPOND_REQUEST = gql`
  mutation RespondToConnectionRequest($requestId: ID!, $accept: Boolean!) {
    respondToConnectionRequest(requestId: $requestId, accept: $accept) {
      id status
      requester { id username }
    }
  }
`;

const REMOVE_CONNECTION = gql`
  mutation RemoveConnection($userId: ID!) {
    removeConnection(userId: $userId)
  }
`;

const CREATE_DM = gql`
  mutation CreateDM($username: String!) {
    createDM(username: $username) {
      id
    }
  }
`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  avatarUrl?: string | null;
  createdAt?: string;
  online?: boolean;
}

interface FriendshipRequest {
  id: string;
  status: string;
  createdAt: string;
  requester: User;
  addressee: User;
}

type Tab = 'search' | 'connections' | 'requests';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ user, size = 10 }: { user: User; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        user.username.charAt(0).toUpperCase()
      )}
    </div>
  );
}

// ─── Search Tab ──────────────────────────────────────────────────────────────

function SearchTab({ myId }: { myId: string }) {
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Debounce 400ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input.trim()), 400);
    return () => clearTimeout(timer);
  }, [input]);

  const [fetchUser, { data, loading: searching, error: searchError }] =
    useLazyQuery<{ user: User | null }>(SEARCH_USER);

  const [sendRequest, { loading: sending }] = useMutation(SEND_REQUEST, {
    onCompleted: () => setStatusMsg({ text: 'Connection request sent!', ok: true }),
    onError: (e) => setStatusMsg({ text: e.message, ok: false }),
  });

  useEffect(() => {
    setStatusMsg(null);
    if (debouncedInput && debouncedInput !== '') {
      fetchUser({ variables: { username: debouncedInput } });
    }
  }, [debouncedInput, fetchUser]);

  const foundUser: User | null = data?.user ?? null;
  const isSelf = foundUser?.id === myId;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          id="user-search-input"
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setStatusMsg(null); }}
          placeholder="Search by exact username…"
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
        {searching && (
          <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {debouncedInput && !searching && (
          <motion.div
            key={debouncedInput}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            {searchError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {searchError.message}
              </p>
            )}

            {!searchError && !foundUser && (
              <p className="text-sm text-slate-500 text-center py-6">
                No user found with username <span className="text-slate-300 font-medium">@{debouncedInput}</span>
              </p>
            )}

            {foundUser && !isSelf && (
              <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3">
                <Avatar user={foundUser} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100">@{foundUser.username}</p>
                </div>
                <button
                  id="send-connection-request-btn"
                  onClick={() => sendRequest({ variables: { username: foundUser.username } })}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  {sending ? 'Sending…' : 'Connect'}
                </button>
              </div>
            )}

            {foundUser && isSelf && (
              <p className="text-sm text-slate-500 text-center py-6">That's you 👋</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status message */}
      <AnimatePresence>
        {statusMsg && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-sm font-medium px-4 py-3 rounded-xl border ${
              statusMsg.ok
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}
          >
            {statusMsg.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Connections Tab ──────────────────────────────────────────────────────────

function ConnectionsTab() {
  const router = useRouter();
  const { data, loading, refetch } = useQuery<{ connections: User[] }>(CONNECTIONS_QUERY);

  const [removeConnection, { loading: removing }] = useMutation(REMOVE_CONNECTION, {
    onCompleted: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const [createDM, { loading: messaging }] = useMutation(CREATE_DM, {
    onCompleted: (data: any) => {
      router.push(`/chat/${data.createDM.id}`);
    },
    onError: (e) => alert(e.message),
  });

  const connections = data?.connections ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Users size={24} className="text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">No connections yet</p>
        <p className="text-xs text-slate-500">Use the Search tab to find and connect with people.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-3">
        {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
      </p>
      {connections.map((user, i) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 rounded-xl px-4 py-3 transition-all group"
        >
          <Avatar user={user} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">@{user.username}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${user.online ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-500">{user.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              title="Message"
              onClick={() => createDM({ variables: { username: user.username } })}
              disabled={messaging || removing}
              className="p-2 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
            >
              {messaging ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
            </button>
            <button
              title="Remove connection"
              onClick={() => {
                if (confirm(`Remove @${user.username} from your connections?`)) {
                  removeConnection({ variables: { userId: user.id } });
                }
              }}
              disabled={removing || messaging}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <UserMinus size={15} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────

function RequestsTab({ myId }: { myId: string }) {
  const { data, loading, refetch } = useQuery<{ connectionRequests: FriendshipRequest[] }>(
    REQUESTS_QUERY
  );

  const [respondRequest, { loading: responding }] = useMutation(RESPOND_REQUEST, {
    onCompleted: () => refetch(),
    onError: (e) => alert(e.message),
  });

  const requests = data?.connectionRequests ?? [];
  // Incoming = I am the addressee (which is what the query returns)
  const incoming = requests;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (incoming.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Clock size={24} className="text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">No pending requests</p>
        <p className="text-xs text-slate-500">When someone sends you a request, it'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-3">
        {incoming.length} pending {incoming.length === 1 ? 'request' : 'requests'}
      </p>
      {incoming.map((req, i) => (
        <motion.div
          key={req.id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3"
        >
          <Avatar user={req.requester} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">@{req.requester.username}</p>
            <p className="text-xs text-slate-500">Wants to connect</p>
          </div>
          <div className="flex gap-2">
            <button
              id={`accept-request-${req.id}`}
              title="Accept"
              onClick={() => respondRequest({ variables: { requestId: req.id, accept: true } })}
              disabled={responding}
              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
            >
              <Check size={15} />
            </button>
            <button
              id={`decline-request-${req.id}`}
              title="Decline"
              onClick={() => respondRequest({ variables: { requestId: req.id, accept: false } })}
              disabled={responding}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('search');

  const { data: meData, error: meError, loading: meLoading } = useQuery<{ me: User }>(ME_QUERY);
  const me: User | undefined = meData?.me;

  useEffect(() => {
    if (meError) {
      router.push('/login');
    }
  }, [meError, router]);

  const { data: requestsData, loading: requestsLoading } = useQuery<{ connectionRequests: FriendshipRequest[] }>(
    REQUESTS_QUERY,
    { pollInterval: 30000 } // poll every 30s for new requests
  );
  
  useSubscription(PRESENCE_SUBSCRIPTION, {
    onData: ({ client, data }) => {
      const event = data.data?.presenceUpdated;
      if (event) {
        client.cache.modify({
          id: client.cache.identify({ __typename: 'User', id: event.userId }),
          fields: {
            online() {
              return event.online;
            }
          }
        });
      }
    }
  });

  const pendingCount = requestsData?.connectionRequests?.length ?? 0;

  if (meLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (meError) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'search', label: 'Search', icon: <Search size={15} /> },
    { id: 'connections', label: 'Connections', icon: <UserCheck size={15} /> },
    {
      id: 'requests',
      label: 'Requests',
      icon: <Clock size={15} />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <h1 className="text-base font-bold">Connections</h1>
          </div>
          {me && (
            <span className="ml-auto text-xs text-slate-500 font-medium">@{me.username}</span>
          )}
        </div>

        {/* Tab Bar */}
        <div className="max-w-lg mx-auto px-4 pb-0 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all relative ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-indigo-500 bg-slate-900/40'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'search' && me && <SearchTab myId={me.id} />}
            {activeTab === 'connections' && <ConnectionsTab />}
            {activeTab === 'requests' && me && <RequestsTab myId={me.id} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
