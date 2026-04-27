'use client';

import { ApolloProvider, useMutation, gql } from '@apollo/client/react';
import client from '@/lib/apollo-client';
import { useEffect } from 'react';
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
  return (
    <ApolloProvider client={client}>
      <KeyInitialiser />
      {children}
    </ApolloProvider>
  );
}
