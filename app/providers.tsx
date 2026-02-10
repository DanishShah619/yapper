'use client';

import { ApolloProvider, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import client from '@/lib/apollo-client';
import { useCallback, useEffect, createContext, useContext, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { getSocket, reconnectSocket } from '@/lib/socketClient';
import { useRouter } from 'next/navigation';

const SocketContext = createContext<{ socket: Socket | null }>({ socket: null });

export const useSocket = () => useContext(SocketContext);
import { getOrCreateKeyPair } from '@/lib/e2ee';

const UPDATE_PUBLIC_KEY = gql`
  mutation UpdatePublicKey($publicKey: String!) {
    updatePublicKey(publicKey: $publicKey) {
      id publicKey
    }
  }
`;

type IncomingCall = {
  videoRoomId: string;
  liveKitRoomId: string | null;
  conversationId: string;
  caller: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
};

/**
 * KeyInitialiser — published the user's ECDH public key to the server on every
 * session start. The private key stays in localStorage and never leaves the device.
 * This enables DM key derivation (task 3.1.4).
 */
function KeyInitialiser() {
  const [updatePublicKey] = useMutation(UPDATE_PUBLIC_KEY, {
    client,
    onCompleted: () => {
      reconnectSocket();
    },
    onError: () => {
      // Silently fail — user isn't logged in yet or token is invalid
    },
  });

  const publishPublicKey = useCallback(async () => {
    try {
      const { publicKey } = await getOrCreateKeyPair();
      if (publicKey) {
        await updatePublicKey({ variables: { publicKey } });
      }
    } catch {
      // Non-fatal: key upload will be retried after auth changes or on next page load
    }
  }, [updatePublicKey]);

  useEffect(() => {
    publishPublicKey();
    window.addEventListener('nexchat:auth-changed', publishPublicKey);
    return () => window.removeEventListener('nexchat:auth-changed', publishPublicKey);
  }, [publishPublicKey]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [socket] = useState<Socket | null>(() =>
    typeof window === 'undefined' ? null : getSocket({ connect: false })
  );
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { toasts, dismissToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;

    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('presence:heartbeat');
      }
    }, 20000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const connectAfterAuthChange = () => {
      reconnectSocket();
    };

    window.addEventListener('nexchat:auth-changed', connectAfterAuthChange);
    return () => window.removeEventListener('nexchat:auth-changed', connectAfterAuthChange);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (call: IncomingCall) => {
      setIncomingCall(call);
    };

    socket.on('call:incoming', handleIncomingCall);
    return () => {
      socket.off('call:incoming', handleIncomingCall);
    };
  }, [socket]);

  const joinIncomingCall = () => {
    if (!incomingCall) return;
    const returnTo = `/chat?room=${incomingCall.conversationId}`;
    router.push(`/video/${incomingCall.videoRoomId}/room?returnTo=${encodeURIComponent(returnTo)}`);
    setIncomingCall(null);
  };

  return (
    <ApolloProvider client={client}>
      <SocketContext.Provider value={{ socket }}>
        <KeyInitialiser />
        {children}
        {incomingCall && (
          <div className="fixed bottom-5 left-5 z-50 w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-[#BAD9F5] bg-white p-4 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1ABC9C]">Incoming video call</p>
            <p className="mt-1 text-sm font-bold text-[#0A0A0A]">{incomingCall.caller.username}</p>
            <p className="mt-0.5 text-xs font-medium text-[#6B7A99]">wants to start a video call</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={joinIncomingCall}
                className="rounded-lg bg-[#1ABC9C] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#17a589]"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => setIncomingCall(null)}
                className="rounded-lg bg-[#E1F0FF] px-3 py-2 text-xs font-bold text-[#1A3A6B] transition-colors hover:bg-[#BAD9F5]"
              >
                Decline
              </button>
            </div>
          </div>
        )}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </SocketContext.Provider>
    </ApolloProvider>
  );
}
