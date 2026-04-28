// lib/keyInit.ts
// Called once when a user logs in.
// Ensures they have a key pair and their public key is on the server.

import {
  generateUserKeyPair,
  savePrivateKey,
  loadPrivateKey
} from "@/lib/crypto";
import  client from "@/lib/apollo-client";
import { gql } from "@apollo/client";

const UPDATE_PUBLIC_KEY = gql`
  mutation UpdatePublicKey($publicKeyJwk: String!) {
    updatePublicKey(publicKeyJwk: $publicKeyJwk)
  }
`;

/**
 * Call this immediately after a successful login.
 * If the user already has a key pair in localStorage, does nothing.
 * If not, generates one and uploads the public key to the server.
 */
export async function initUserKeys(userId: string): Promise<void> {
  const existingPrivateKey = loadPrivateKey(userId);

  if (existingPrivateKey) {
    // Key pair already exists — nothing to do
    return;
  }

  // First time — generate a fresh key pair
  const { publicKeyJwk, privateKeyJwk } = await generateUserKeyPair();

  // Save private key to localStorage — it never leaves this device
  savePrivateKey(userId, privateKeyJwk);

  // Upload public key to server — safe to store there
  await client.mutate({
    mutation: UPDATE_PUBLIC_KEY,
    variables: { publicKeyJwk }
  });

  console.log("[NexChat Crypto] Key pair initialised for user", userId);
}