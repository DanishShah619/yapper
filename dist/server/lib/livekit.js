"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomService = void 0;
exports.generateLiveKitToken = generateLiveKitToken;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("./env");
exports.roomService = new livekit_server_sdk_1.RoomServiceClient(env_1.env.LIVEKIT_URL, env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET);
async function generateLiveKitToken(userId, roomId) {
    const token = new livekit_server_sdk_1.AccessToken(env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET, {
        identity: userId,
    });
    token.addGrant({
        roomJoin: true,
        room: roomId,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });
    return await token.toJwt();
}
