"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUserKeyPair = generateUserKeyPair;
exports.savePrivateKey = savePrivateKey;
exports.loadPrivateKey = loadPrivateKey;
exports.generateRoomKey = generateRoomKey;
exports.wrapRoomKeyForMember = wrapRoomKeyForMember;
exports.unwrapRoomKey = unwrapRoomKey;
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
async function generateUserKeyPair() {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, // extractable — we need to export and store them
    ["deriveKey"] // usage
    );
    const publicKeyJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey));
    const privateKeyJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.privateKey));
    return { publicKeyJwk, privateKeyJwk };
}
/**
 * Save the user's private key to localStorage.
 * IMPORTANT: This never leaves the browser. Do NOT send this to the server.
 */
function savePrivateKey(userId, privateKeyJwk) {
    localStorage.setItem(`nexchat_privkey_${userId}`, privateKeyJwk);
}
/**
 * Load the user's private key from localStorage.
 * Returns null if not found — trigger key regeneration if this happens.
 */
function loadPrivateKey(userId) {
    return localStorage.getItem(`nexchat_privkey_${userId}`);
}
// ── SECTION 2: Room Key (AES-GCM) ────────────────────────────────────────────
// Each room has one AES-GCM symmetric key.
// This key encrypts all messages in the room.
// It is NEVER sent to the server in plaintext.
/**
 * Generate a new AES-GCM room key.
 * Call this when creating a room or rotating keys.
 */
async function generateRoomKey() {
    return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, // extractable — needed to wrap it for each member
    ["encrypt", "decrypt"]);
}
// ── SECTION 3: Key Wrapping (Room Key → Shard) ───────────────────────────────
// Wrapping = encrypting the room key with a member's public key.
// The result is a "shard" — safe to store on the server.
/**
 * Wrap (encrypt) a room key for a specific member using their public key.
 * The result (encryptedShard) is safe to send to the server.
 *
 * How it works:
 * 1. Import the member's public key
 * 2. Generate a shared ECDH secret between our private key and their public key
 * 3. Use that shared secret to AES-wrap the room key
 * 4. Return the wrapped key as a base64 string
 *
 * @param roomKey - The CryptoKey to protect
 * @param recipientPublicKeyJwk - The recipient's public key (from server)
 * @param senderPrivateKeyJwk - Our own private key (from localStorage)
 */
async function wrapRoomKeyForMember(roomKey, recipientPublicKeyJwk, senderPrivateKeyJwk) {
    // Import recipient's public key
    const recipientPublicKey = await crypto.subtle.importKey("jwk", JSON.parse(recipientPublicKeyJwk), { name: "ECDH", namedCurve: "P-256" }, false, []);
    // Import sender's private key
    const senderPrivateKey = await crypto.subtle.importKey("jwk", JSON.parse(senderPrivateKeyJwk), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    // Derive a shared AES key from the ECDH key pair
    const sharedKey = await crypto.subtle.deriveKey({ name: "ECDH", public: recipientPublicKey }, senderPrivateKey, { name: "AES-KW", length: 256 }, // AES Key Wrap — designed specifically for wrapping keys
    false, ["wrapKey"]);
    // Wrap the room key using the shared key
    const wrappedKeyBuffer = await crypto.subtle.wrapKey("raw", roomKey, sharedKey, "AES-KW");
    // Convert to base64 string for storage
    return btoa(String.fromCharCode(...new Uint8Array(wrappedKeyBuffer)));
}
/**
 * Unwrap (decrypt) a shard to recover the room key.
 * Call this when a member joins a room or receives a key rotation event.
 *
 * @param encryptedShard - The base64 shard from the server
 * @param senderPublicKeyJwk - The public key of whoever wrapped this shard
 * @param recipientPrivateKeyJwk - Our own private key (from localStorage)
 */
async function unwrapRoomKey(encryptedShard, senderPublicKeyJwk, recipientPrivateKeyJwk) {
    // Decode base64 back to ArrayBuffer
    const wrappedKeyBuffer = Uint8Array.from(atob(encryptedShard), c => c.charCodeAt(0)).buffer;
    // Import sender's public key
    const senderPublicKey = await crypto.subtle.importKey("jwk", JSON.parse(senderPublicKeyJwk), { name: "ECDH", namedCurve: "P-256" }, false, []);
    // Import our private key
    const recipientPrivateKey = await crypto.subtle.importKey("jwk", JSON.parse(recipientPrivateKeyJwk), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    // Derive the same shared key (ECDH is symmetric — both sides get the same result)
    const sharedKey = await crypto.subtle.deriveKey({ name: "ECDH", public: senderPublicKey }, recipientPrivateKey, { name: "AES-KW", length: 256 }, false, ["unwrapKey"]);
    // Unwrap to get back the room key
    return crypto.subtle.unwrapKey("raw", wrappedKeyBuffer, sharedKey, "AES-KW", { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
// ── SECTION 4: Message Encryption ────────────────────────────────────────────
/**
 * Encrypt a plaintext message using the room key.
 * Returns a base64 string containing IV + ciphertext (safe to send to server).
 */
async function encryptMessage(plaintext, roomKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, roomKey, encoded);
    // Prepend IV to ciphertext and encode as base64
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
}
/**
 * Decrypt an encrypted message payload using the room key.
 * @param encryptedPayload - The base64 string from the server
 * @param roomKey - The decrypted room key (from unwrapRoomKey)
 */
async function decryptMessage(encryptedPayload, roomKey) {
    const combined = Uint8Array.from(atob(encryptedPayload), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12); // First 12 bytes = IV
    const ciphertext = combined.slice(12); // Rest = ciphertext
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, roomKey, ciphertext);
    return new TextDecoder().decode(plaintext);
}
