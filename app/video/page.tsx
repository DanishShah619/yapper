"use client";

import { LiveKitRoom, ControlBar, ParticipantTile, useRoomContext } from "@livekit/components-react";
import { useState } from "react";

export default function VideoPage({ roomId, token }: { roomId: string; token: string }) {
  const [joined, setJoined] = useState(false);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-900">
      {!joined ? (
        <button
          className="m-auto px-6 py-3 bg-blue-600 text-white rounded text-lg"
          onClick={() => setJoined(true)}
        >
          Join Video Room
        </button>
      ) : (
        <LiveKitRoom
          serverUrl="wss://localhost:7880"
          token={token}
          className="flex-1 flex flex-col"
          video={true}
          audio={true}
        >
          <div className="flex-1 flex flex-wrap items-center justify-center">
            <ParticipantTile />
          </div>
          <ControlBar className="w-full" />
        </LiveKitRoom>
      )}
    </div>
  );
}
