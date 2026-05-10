"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSendMessage = useSendMessage;
const react_1 = require("@apollo/client/react");
const client_1 = require("@apollo/client");
const react_2 = require("react");
const e2ee_1 = require("@/lib/e2ee");
const apollo_client_1 = __importDefault(require("@/lib/apollo-client"));
const SEND_MESSAGE = (0, client_1.gql) `
  mutation SendMessage($roomId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!, $ttl: Int, $fileId: ID) {
    sendMessage(roomId: $roomId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral, ttl: $ttl, fileId: $fileId) {
      id
      roomId
      encryptedPayload
      ephemeral
      expiresAt
      createdAt
      sender { id username avatarUrl }
      file { id encryptedMetadata createdAt uploader { id username avatarUrl } }
    }
  }
`;
const UPLOAD_FILE = (0, client_1.gql) `
  mutation UploadFile($roomId: ID!, $encryptedBlob: String!, $encryptedMetadata: String!) {
    uploadFile(roomId: $roomId, encryptedBlob: $encryptedBlob, encryptedMetadata: $encryptedMetadata) {
      id
      encryptedMetadata
      createdAt
      uploader { id username avatarUrl }
    }
  }
`;
const ME_QUERY = (0, client_1.gql) `
  query SendMessageMe {
    me { id publicKey }
  }
`;
const CONVERSATION_KEY_QUERY = (0, client_1.gql) `
  query SendMessageConversationKey($id: ID!) {
    conversation(id: $id) {
      id
      members {
        user { id publicKey }
      }
    }
  }
`;
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}
function useSendMessage() {
    const [error, setError] = (0, react_2.useState)(null);
    const [sendMessageMutation, { loading: mutationLoading }] = (0, react_1.useMutation)(SEND_MESSAGE);
    const [uploadFileMutation, { loading: uploadLoading }] = (0, react_1.useMutation)(UPLOAD_FILE);
    const [isEncrypting, setIsEncrypting] = (0, react_2.useState)(false);
    const loading = mutationLoading || uploadLoading || isEncrypting;
    const sendMessage = async ({ roomId, plaintext, ephemeral, ttl, currentUserId, attachment, }) => {
        var _a, _b, _c, _d;
        setError(null);
        setIsEncrypting(true);
        try {
            const [{ data: meData }, { data: conversationData }] = await Promise.all([
                apollo_client_1.default.query({
                    query: ME_QUERY,
                    fetchPolicy: "network-only",
                }),
                apollo_client_1.default.query({
                    query: CONVERSATION_KEY_QUERY,
                    variables: { id: roomId },
                    fetchPolicy: "network-only",
                }),
            ]);
            if (!(meData === null || meData === void 0 ? void 0 : meData.me))
                throw new Error("Not authenticated");
            const room = conversationData === null || conversationData === void 0 ? void 0 : conversationData.conversation;
            if (!room)
                throw new Error("Conversation not found");
            const myId = currentUserId || meData.me.id;
            const { privateKey } = await (0, e2ee_1.getOrCreateKeyPair)();
            if (!privateKey)
                throw new Error("Local encryption key is unavailable");
            let roomKey = await (0, e2ee_1.loadRoomKey)(roomId);
            if (!roomKey && room.members.length <= 2) {
                const otherMember = (_a = room.members.find((member) => member.user.id !== myId)) === null || _a === void 0 ? void 0 : _a.user;
                const peerPublicKey = (_b = otherMember === null || otherMember === void 0 ? void 0 : otherMember.publicKey) !== null && _b !== void 0 ? _b : meData.me.publicKey;
                if (!peerPublicKey) {
                    throw new Error("The recipient has not published an encryption key yet");
                }
                roomKey = await (0, e2ee_1.getDMRoomKey)(roomId, privateKey, peerPublicKey);
            }
            if (!roomKey) {
                throw new Error("Room key unavailable. Ask an admin to redeliver the room key.");
            }
            if (attachment && ephemeral) {
                throw new Error("Attachments are not supported on ephemeral messages yet");
            }
            let fileId;
            const messageText = plaintext.trim() || (attachment ? "Attachment" : plaintext);
            if (attachment) {
                const encryptedBuffer = await (0, e2ee_1.encryptFile)(await attachment.arrayBuffer(), roomKey);
                const encryptedBlob = arrayBufferToBase64(encryptedBuffer);
                const encryptedMetadata = await (0, e2ee_1.encryptMessage)(JSON.stringify({
                    name: attachment.name,
                    type: attachment.type || "application/octet-stream",
                    size: attachment.size,
                }), roomKey);
                const uploadResult = await uploadFileMutation({
                    variables: {
                        roomId,
                        encryptedBlob,
                        encryptedMetadata,
                    },
                });
                fileId = (_d = (_c = uploadResult.data) === null || _c === void 0 ? void 0 : _c.uploadFile) === null || _d === void 0 ? void 0 : _d.id;
                if (!fileId)
                    throw new Error("File upload failed");
            }
            const encryptedPayload = await (0, e2ee_1.encryptMessage)(messageText, roomKey);
            await sendMessageMutation({
                variables: {
                    roomId,
                    encryptedPayload,
                    ephemeral,
                    ttl,
                    fileId,
                },
            });
            return true;
        }
        catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Room key unavailable. Try refreshing.");
            return false;
        }
        finally {
            setIsEncrypting(false);
        }
    };
    return { sendMessage, loading, error };
}
