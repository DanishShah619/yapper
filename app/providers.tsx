'use client';

import { ApolloProvider, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import client from '@/lib/apollo-client';
import { useEffect, useRef, createContext, useContext, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ToastContainer, useToast } from '@/components/ui/Toast';

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

/**
 * KeyInitialiser — published the user's ECDH public key to the server on every
 * session start. The private key stays in localStorage and never leaves the device.
 * This enables DM key derivation (task 3.1.4).
 */
function KeyInitialiser() {
  const [updatePublicKey] = useMutation(UPDATE_PUBLIC_KEY, {
    client,
    onError: () => {
      // Silently fail — user isn't logged in yet or token is invalid
    },
  });

  useEffect(() => {
    const token = localStorage.getItem('nexchat_token');
    if (!token) return;

    (async () => {
      try {
        const { publicKey } = await getOrCreateKeyPair();
        if (publicKey) {
          await updatePublicKey({ variables: { publicKey } });
        }
      } catch {
        // Non-fatal: key upload will be retried on next page load
      }
    })();
  // The effect intentionally runs only once on mount; dependencies are static
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { toasts, dismissToast } = useToast();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexchat_token') : null;
    
    const s = io({ 
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      auth: token ? { token } : undefined
    });
    
    setSocket(s);

    const heartbeatInterval = setInterval(() => {
      if (s.connected) {
        s.emit('presence:heartbeat');
      }
    }, 20000);

    return () => {
      clearInterval(heartbeatInterval);
      s.disconnect();
    };
  }, []);

  return (
    <ApolloProvider client={client}>
      <SocketContext.Provider value={{ socket }}>
        <KeyInitialiser />
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </SocketContext.Provider>
    </ApolloProvider>
  );
}
