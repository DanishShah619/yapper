"use strict";
// lib/keyInit.ts
// Called once when a user logs in.
// Ensures they have a key pair and their public key is on the server.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUserKeys = initUserKeys;
const crypto_1 = require("@/lib/crypto");
const apollo_client_1 = __importDefault(require("@/lib/apollo-client"));
const client_1 = require("@apollo/client");
const UPDATE_PUBLIC_KEY = (0, client_1.gql) `
  mutation UpdatePublicKey($publicKeyJwk: String!) {
    updatePublicKey(publicKeyJwk: $publicKeyJwk)
  }
`;
/**
 * Call this immediately after a successful login.
 * If the user already has a key pair in localStorage, does nothing.
 * If not, generates one and uploads the public key to the server.
 */
async function initUserKeys(userId) {
    const existingPrivateKey = (0, crypto_1.loadPrivateKey)(userId);
    if (existingPrivateKey) {
        // Key pair already exists — nothing to do
        return;
    }
    // First time — generate a fresh key pair
    const { publicKeyJwk, privateKeyJwk } = await (0, crypto_1.generateUserKeyPair)();
    // Save private key to localStorage — it never leaves this device
    (0, crypto_1.savePrivateKey)(userId, privateKeyJwk);
    // Upload public key to server — safe to store there
    await apollo_client_1.default.mutate({
        mutation: UPDATE_PUBLIC_KEY,
        variables: { publicKeyJwk }
    });
    console.log("[NexChat Crypto] Key pair initialised for user", userId);
}
