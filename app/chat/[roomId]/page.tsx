'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Loader2,
  Lock,
  MessageSquareOff,
  ShieldAlert,
  Clock,
  MoreVertical,
} from 'lucide-react';
import {
  getOrCreateKeyPair,
  getDMRoomKey,
  encryptMessage,
  decryptMessage,
} from '@/lib/e2ee';

// ─── GraphQL ─────────────────────────────────────────────────────────────────

const ME_QUERY = gql`
  query Me { me { id username avatarUrl publicKey } }
`;

const CONVERSATION_QUERY = gql`
  query Conversation($id: ID!) {
    conversation(id: $id) {
      id name type locked createdAt
      members {
        user { id username avatarUrl publicKey }
      }
    }
  }
`;

const MESSAGES_QUERY = gql`
  query Messages($roomId: ID, $groupId: ID, $limit: Int) {
    messages(roomId: $roomId, groupId: $groupId, limit: $limit) {
      edges {
        id encryptedPayload ephemeral createdAt
        sender { id username avatarUrl }
      }
    }
  }
`;

const MESSAGE_RECEIVED_SUBSCRIPTION = gql`
  subscription MessageReceived($roomId: ID!) {
    messageReceived(roomId: $roomId) {
      id encryptedPayload ephemeral createdAt
      sender { id username avatarUrl }
    }
  }
`;

const MISSED_EPHEMERAL_MESSAGES_QUERY = gql`
  query MissedEphemeralMessages($roomId: ID!, $since: Float!) {
    missedEphemeralMessages(roomId: $roomId, since: $since) {
      id encryptedPayload ephemeral createdAt
      sender { id username avatarUrl }
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($roomId: ID, $groupId: ID, $encryptedPayload: String!, $ephemeral: Boolean, $ttl: Int) {
    sendMessage(roomId: $roomId, groupId: $groupId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl) {
      id encryptedPayload ephemeral createdAt
      sender { id username avatarUrl }
    }
  }
`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  avatarUrl?: string | null;
  publicKey?: string | null;
}

interface Message {
  id: string;
  encryptedPayload: string;
  ephemeral: boolean;
  createdAt: string;
  sender: User;
  // added locally after decryption:
  plaintext?: string;
  decryptionFailed?: boolean;
}

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();

  const [input, setInput] = useState('');
  const [ephemeral, setEphemeral] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Authenticate & load self
  const { data: meData } = useQuery<{ me: User }>(ME_QUERY);
  const me: User | undefined = meData?.me;

  // 2. Load Conversation
  const { data: convData, loading: convLoading, error: convError } = useQuery<{ conversation: any }>(CONVERSATION_QUERY, {
    variables: { id: roomId },
    skip: !me,
  });
  const room = convData?.conversation;

  const otherMember = room?.members.find((m: any) => m.user.id !== me?.id)?.user;
  const isSelfDM = room?.members.length === 1;

  // 3. Derive ECDH Key once we have both parties
  useEffect(() => {
    if (!me || !room) return;

    (async () => {
      try {
        const { privateKey: myPriv } = await getOrCreateKeyPair();
        if (!myPriv) throw new Error('Missing local private key');

        let theirPub = otherMember?.publicKey;
        if (isSelfDM) theirPub = me.publicKey;

        if (!theirPub) {
          setKeyError('Other user has not set up E2EE keys yet.');
          return;
        }

        const derived = await getDMRoomKey(roomId, myPriv, theirPub);
        setRoomKey(derived);
      } catch (err: any) {
        setKeyError(err.message || 'Failed to derive E2E key.');
      }
    })();
  }, [me, room, otherMember, isSelfDM, roomId]);

  // 4. Load messages
  const { data: msgData, refetch: refetchMessages, subscribeToMore } = useQuery<{ messages: { edges: any[] } }>(MESSAGES_QUERY, {
    variables: { roomId, limit: 100 },
    skip: !roomId || !roomKey, // only fetch after key is ready
  });

  const [gapWarning, setGapWarning] = useState(false);
  const lastReceivedAt = useRef<number>(Date.now());
  const client = useApolloClient();

  useEffect(() => {
    if (!subscribeToMore || !roomId) return;
    const unsubscribe = subscribeToMore({
      document: MESSAGE_RECEIVED_SUBSCRIPTION,
      variables: { roomId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev as { messages: { edges: any[] } };
        const newMsg = (subscriptionData.data as unknown as { messageReceived: any }).messageReceived;
        lastReceivedAt.current = Date.now();
        if (prev.messages?.edges?.some((m: any) => m.id === newMsg.id)) return prev as { messages: { edges: any[] } };
        return {
          ...prev,
          messages: {
            ...prev.messages,
            edges: [...(prev.messages?.edges || []), newMsg],
          }
        } as { messages: { edges: any[] } };
      }
    });
    return () => unsubscribe();
  }, [subscribeToMore, roomId]);

  useEffect(() => {
    const handleReconnect = async () => {
      const gapMs = Date.now() - lastReceivedAt.current;
      if (gapMs > 55000) {
        setGapWarning(true);
        return;
      }
      if (gapMs > 5000) { 
         await client.query({
          query: MISSED_EPHEMERAL_MESSAGES_QUERY,
          variables: { roomId, since: lastReceivedAt.current },
          fetchPolicy: 'network-only'
        });
        refetchMessages();
      }
      lastReceivedAt.current = Date.now();
    };
    
    window.addEventListener('online', handleReconnect);
    return () => window.removeEventListener('online', handleReconnect);
  }, [roomId, client, refetchMessages]);

  // Decrypt batch of messages when query data updates
  useEffect(() => {
    if (!msgData?.messages?.edges || !roomKey) return;

    (async () => {
      const edges = msgData.messages.edges as Message[];
      const decrypted = await Promise.all(
        edges.map(async (m) => {
          try {
            const p = await decryptMessage(m.encryptedPayload, roomKey);
            return { ...m, plaintext: p, decryptionFailed: false };
          } catch (e) {
            return { ...m, plaintext: '[Decryption failed]', decryptionFailed: true };
          }
        })
      );
      setMessages(decrypted);
    })();
  }, [msgData, roomKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5. Send Message
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomKey || !me) return;

    const payload = input.trim();
    setInput('');

    try {
      const encryptedPayload = await encryptMessage(payload, roomKey);

      // Optimistic locally
      const tempId = `temp-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          encryptedPayload,
          ephemeral,
          createdAt: new Date().toISOString(),
          sender: me,
          plaintext: payload,
        },
      ]);

      await sendMessage({
        variables: {
          roomId,
          encryptedPayload,
          ephemeral,
          ttl: ephemeral ? 300 : undefined, // 5 min TTL
        },
      });

      refetchMessages();
    } catch (e: any) {
      alert(`Send failed: ${e.message}`);
    }
  };

  if (convError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <MessageSquareOff size={40} className="text-red-400 mb-4" />
        <p className="text-red-400">{convError.message}</p>
        <button onClick={() => router.push('/')} className="mt-4 text-slate-400 hover:text-white">
          Go back
        </button>
      </div>
    );
  }

  if (convLoading || !me) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center max-w-lg mx-auto">
      {/* Header */}
      <header className="w-full border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          
          {otherMember && <Avatar user={otherMember} size={8} />}
          
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-100 truncate">
              {otherMember ? `@${otherMember.username}` : (isSelfDM ? 'Note to Self' : 'Direct Message')}
            </h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Lock size={10} className="text-emerald-400" />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                E2E Encrypted
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 w-full bg-[#0B0E14] overflow-y-auto p-4 flex flex-col gap-3">
        {keyError ? (
          <div className="m-auto p-4 bg-red-900/20 border border-red-500/30 rounded-2xl flex flex-col items-center text-center">
            <ShieldAlert size={32} className="text-red-400 mb-2" />
            <h2 className="text-sm font-bold text-red-400">Encryption Error</h2>
            <p className="text-xs text-red-300/70 mt-1 max-w-[200px]">{keyError}</p>
          </div>
        ) : !roomKey ? (
          <div className="m-auto flex flex-col items-center text-center">
            <Loader2 size={24} className="animate-spin text-indigo-400 mb-2" />
            <p className="text-xs text-slate-500">Exchanging keys...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center text-center opacity-50">
            <Lock size={32} className="text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-400">Say hello!</p>
            <p className="text-xs text-slate-500 mt-1">Messages are end-to-end encrypted.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.sender.id === me?.id;
            const showAvatar = !isMe && (i === 0 || messages[i - 1].sender.id !== m.sender.id);
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={m.id}
                className={`flex gap-2 max-w-[85%] ${isMe ? 'ml-auto' : 'mr-auto'}`}
              >
                {!isMe && (
                  <div className="w-8 shrink-0 flex items-end">
                    {showAvatar && <Avatar user={m.sender} size={8} />}
                  </div>
                )}
                
                <div
                  className={`rounded-2xl px-4 py-2.5 relative group ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/50'
                  } ${m.decryptionFailed ? 'opacity-50' : ''}`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{m.plaintext || '...'}</p>
                  
                  {m.ephemeral && (
                    <div className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} bg-slate-900 border border-slate-700 rounded-full p-1`}>
                      <Clock size={10} className="text-amber-400" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </main>

      {/* Input area */}
      <footer className="w-full bg-slate-950/90 backdrop-blur-sm border-t border-slate-800/60 p-4">
        <form onSubmit={handleSend} className="flex flex-col gap-2 relative">
          {/* Ephemeral toggle */}
          <div className="flex items-center gap-2 justify-end mb-1">
            <button
              type="button"
              onClick={() => setEphemeral(!ephemeral)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
                ephemeral 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-slate-800 border-slate-700/50 text-slate-500 hover:text-slate-400'
              }`}
            >
              <Clock size={12} />
              {ephemeral ? 'Destruct: 5m' : 'Permanent'}
            </button>
          </div>

          <div className="flex bg-slate-900 border border-slate-700/50 rounded-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all p-1">
             <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message..."
                disabled={!roomKey || !!keyError}
                className="flex-1 bg-transparent px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
             />
             <button
               type="submit"
               disabled={!input.trim() || !roomKey || sending}
               className="w-10 h-10 shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl flex items-center justify-center transition-all"
             >
               {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
             </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
