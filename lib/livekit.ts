import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

export const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL || "ws://localhost:7880",
  process.env.LIVEKIT_API_KEY || "",
  process.env.LIVEKIT_API_SECRET || ""
);

export async function generateLiveKitToken(userId: string, roomId: string): Promise<string> {
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
  return await token.toJwt();
}
