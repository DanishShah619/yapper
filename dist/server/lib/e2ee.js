"use strict";
/**
 * lib/e2ee.ts — Client-Side End-to-End Encryption Engine
 *
 * Uses the Web Crypto API (native in browsers + Node.js 18+):
 *   • AES-GCM 256-bit  — message and file encryption (PRD NFR-1)
 *   • ECDH P-256        — DM key derivation (PRD task 3.1.4)
 *
 * The server only ever sees and stores encrypted ciphertext — it is a
 * blind relay and storage layer. Private keys NEVER leave the device.
 *
 * Tasks 3.1.1 – 3.1.4 (replaces incorrect libsodium implementation — B-05 fix)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2EEKeyMissingError = void 0;
exports.generateRoomKey = generateRoomKey;
exports.exportRoomKey = exportRoomKey;
exports.importRoomKey = importRoomKey;
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
exports.encryptFile = encryptFile;
exports.decryptFile = decryptFile;
exports.generateKeyPair = generateKeyPair;
exports.deriveRoomKey = deriveRoomKey;
exports.storeRoomKey = storeRoomKey;
exports.loadRoomKey = loadRoomKey;
exports.unwrapGroupKey = unwrapGroupKey;
exports.wrapGroupKeyForNewMember = wrapGroupKeyForNewMember;
exports.getOrRequestGroupKey = getOrRequestGroupKey;
exports.generateAndStoreGroupKey = generateAndStoreGroupKey;
exports.getOrCreateKeyPair = getOrCreateKeyPair;
exports.getDMRoomKey = getDMRoomKey;
// ─── Local storage key namespaces ────────────────────────────────────────────
const NS_ROOM_KEY = 'nexchat:roomKey:';
const NS_PRIV_KEY = 'nexchat:myPrivateKey';
const NS_PUB_KEY = 'nexchat:myPublicKey';
// ─── AES-GCM Room Key ─────────────────────────────────────────────────────────
/** Generate a fresh AES-GCM 256-bit symmetric key for a room or group. */
async function generateRoomKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
/**
 * Export a CryptoKey to a base64 string (JSON Web Key → base64).
 * Used for localStorage serialisation only — never transmitted to the server.
 */
async function exportRoomKey(key) {
    const jwk = await crypto.subtle.exportKey('jwk', key);
    return btoa(JSON.stringify(jwk));
}
/** Import a base64-serialised room key back to a CryptoKey. */
async function importRoomKey(base64) {
    const jwk = JSON.parse(atob(base64));
    return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
// ─── Message Encryption ───────────────────────────────────────────────────────
/**
 * Encrypt a UTF-8 plaintext string with AES-GCM.
 * Output format: base64( IV[12 bytes] || ciphertext )
 * The 12-byte nonce is randomly generated per message (PRD NFR-1).
 */
async function encryptMessage(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    // Prepend IV, then base64-encode the combined buffer
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), 12);
    return btoa(String.fromCharCode(...combined));
}
/**
 * Decrypt a base64( IV || ciphertext ) payload produced by encryptMessage.
 * Returns the original UTF-8 plaintext.
 */
async function decryptMessage(ciphertext, key) {
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
}
// ─── File Encryption ──────────────────────────────────────────────────────────
/**
 * Encrypt an ArrayBuffer (file contents) using AES-GCM.
 * Returns an ArrayBuffer with a random 12-byte IV prepended.
 */
async function encryptFile(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), 12);
    return combined.buffer;
}
/**
 * Decrypt an ArrayBuffer produced by encryptFile.
 */
async function decryptFile(data, key) {
    const combined = new Uint8Array(data);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
}
// ─── ECDH Key Pair ────────────────────────────────────────────────────────────
/**
 * Generate an ECDH P-256 key pair.
 * Returns base64-encoded JWK strings for both public and private keys.
 *
 * The public key is uploaded to the server (stored in user.publicKey).
 * The private key NEVER leaves the device — stored in localStorage only.
 *
 * Task 3.1.4
 */
async function generateKeyPair() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const [pubJwk, privJwk] = await Promise.all([
        crypto.subtle.exportKey('jwk', pair.publicKey),
        crypto.subtle.exportKey('jwk', pair.privateKey),
    ]);
    return {
        publicKey: btoa(JSON.stringify(pubJwk)),
        privateKey: btoa(JSON.stringify(privJwk)),
    };
}
/**
 * Derive a shared AES-GCM room key from this user's ECDH private key and
 * the other party's ECDH public key.
 *
 * ECDH property: ECDH(A.priv, B.pub) === ECDH(B.priv, A.pub)
 * Both parties independently derive the same key — no key material is transmitted.
 */
async function deriveRoomKey(myPrivateKeyBase64, theirPublicKeyBase64) {
    const myPrivJwk = JSON.parse(atob(myPrivateKeyBase64));
    const theirPubJwk = JSON.parse(atob(theirPublicKeyBase64));
    const [myPrivKey, theirPubKey] = await Promise.all([
        crypto.subtle.importKey('jwk', myPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']),
        crypto.subtle.importKey('jwk', theirPubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []),
    ]);
    return crypto.subtle.deriveKey({ name: 'ECDH', public: theirPubKey }, myPrivKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
// ─── Local Storage Helpers ────────────────────────────────────────────────────
function isClient() {
    return typeof window !== 'undefined';
}
/** Persist a room key to localStorage under `nexchat:roomKey:{roomId}`. */
async function storeRoomKey(roomId, key) {
    if (!isClient())
        return;
    const exported = await exportRoomKey(key);
    localStorage.setItem(`${NS_ROOM_KEY}${roomId}`, exported);
}
/** Load a previously stored room key from localStorage. Returns null if absent. */
async function loadRoomKey(roomId) {
    if (!isClient())
        return null;
    const stored = localStorage.getItem(`${NS_ROOM_KEY}${roomId}`);
    if (!stored)
        return null;
    try {
        return await importRoomKey(stored);
    }
    catch (_a) {
        localStorage.removeItem(`${NS_ROOM_KEY}${roomId}`);
        return null;
    }
}
class E2EEKeyMissingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'E2EEKeyMissingError';
    }
}
exports.E2EEKeyMissingError = E2EEKeyMissingError;
/**
 * Unwrap a group AES-GCM key derived from a pairwise-wrapped payload.
 */
async function unwrapGroupKey(wrappedKeyB64, senderPublicKeyB64, myPrivateKeyB64) {
    const combined = new Uint8Array(Array.from(atob(wrappedKeyB64)).map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const wrapped = combined.slice(12);
    const sharedSecret = await deriveRoomKey(myPrivateKeyB64, senderPublicKeyB64);
    return crypto.subtle.unwrapKey('raw', wrapped, sharedSecret, { name: 'AES-GCM', iv }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
/**
 * Wrap a group AES-GCM key to send to a new group member via pairwise ECDH.
 */
async function wrapGroupKeyForNewMember(groupKey, newMemberPublicKeyB64, myPrivateKeyB64) {
    const sharedSecret = await deriveRoomKey(myPrivateKeyB64, newMemberPublicKeyB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedKey = await crypto.subtle.wrapKey('raw', groupKey, sharedSecret, { name: 'AES-GCM', iv });
    const combined = new Uint8Array([...Array.from(iv), ...Array.from(new Uint8Array(wrappedKey))]);
    return btoa(String.fromCharCode(...combined));
}
/**
 * Get the group key from local storage, or gracefully throw so the UI can recover.
 */
async function getOrRequestGroupKey(groupId, encryptedKey, senderPublicKey) {
    const cached = await loadRoomKey(groupId);
    if (cached)
        return cached;
    if (encryptedKey && senderPublicKey) {
        const { privateKey } = await getOrCreateKeyPair();
        const unwrapped = await unwrapGroupKey(encryptedKey, senderPublicKey, privateKey);
        await storeRoomKey(groupId, unwrapped);
        return unwrapped;
    }
    throw new E2EEKeyMissingError('Your encryption key for this group has not been delivered yet. ' +
        'Wait or ask a group admin to open the app so it can be sent to you.');
}
async function generateAndStoreGroupKey(groupId) {
    const key = await generateRoomKey();
    await storeRoomKey(groupId, key);
    return key;
}
/**
 * Get or create the user's ECDH key pair from localStorage.
 * Generates and persists a fresh pair on first call.
 * The private key never leaves the device.
 */
async function getOrCreateKeyPair() {
    if (!isClient())
        return { publicKey: '', privateKey: '' };
    const storedPriv = localStorage.getItem(NS_PRIV_KEY);
    const storedPub = localStorage.getItem(NS_PUB_KEY);
    if (storedPriv && storedPub) {
        return { publicKey: storedPub, privateKey: storedPriv };
    }
    const pair = await generateKeyPair();
    localStorage.setItem(NS_PRIV_KEY, pair.privateKey);
    localStorage.setItem(NS_PUB_KEY, pair.publicKey);
    return pair;
}
/**
 * Get or derive a DM room key via ECDH.
 * The derived key is cached in localStorage to avoid re-derivation on every page load.
 *
 * @param dmRoomId      The DM room UUID (used as cache key)
 * @param myPrivateKey  This user's ECDH private key (base64 JWK)
 * @param theirPublicKey  Other user's ECDH public key (base64 JWK from server)
 */
async function getDMRoomKey(dmRoomId, myPrivateKey, theirPublicKey) {
    const cached = await loadRoomKey(dmRoomId);
    if (cached)
        return cached;
    const derived = await deriveRoomKey(myPrivateKey, theirPublicKey);
    await storeRoomKey(dmRoomId, derived);
    return derived;
}
