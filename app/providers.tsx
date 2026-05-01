'use client';

import { ApolloProvider, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import client from '@/lib/apollo-client';
import { useCallback, useEffect, createContext, useContext, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { getSocket, reconnectSocket } from '@/lib/socketClient';

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
  const { toasts, dismissToast } = useToast();

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
