import { AccessToken } from "livekit-server-sdk";

export function generateLiveKitToken(userId: string, roomId: string): string {
  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";
  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
  });
  token.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}
