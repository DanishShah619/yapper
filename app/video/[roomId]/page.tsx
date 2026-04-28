"use client";

import { useEffect, useState, use } from "react";
import { LiveKitRoom, ControlBar, ParticipantTile, RoomAudioRenderer, GridLayout } from "@livekit/components-react";
import { useQuery, useSubscription, gql } from "@apollo/client";
import { io } from "socket.io-client";
import WaitingRoomPanel from "@/components/ui/WaitingRoom";
import "@livekit/components-styles";

const GET_LIVEKIT_TOKEN = gql`
  query GetLiveKitToken($roomId: ID!) {
    getLiveKitToken(roomId: $roomId)
  }
`;

const PARTICIPANT_APPROVED_SUB = gql`
  subscription ParticipantApproved($videoRoomId: ID!) {
    participantApproved(videoRoomId: $videoRoomId)
  }
`;

const PARTICIPANT_REJECTED_SUB = gql`
  subscription ParticipantRejected($videoRoomId: ID!) {
    participantRejected(videoRoomId: $videoRoomId)
  }
`;

const GET_ME = gql`
  query Me {
    me {
      id
      username
    }
  }
`;

export default function VideoPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<"initial" | "waiting" | "approved" | "rejected">("initial");
  const [token, setToken] = useState("");
  const { data: meData } = useQuery(GET_ME);

  const { data: tokenData, refetch: fetchToken } = useQuery(GET_LIVEKIT_TOKEN, {
    variables: { roomId },
    skip: true, // Only fetch when approved
  });

  useSubscription(PARTICIPANT_APPROVED_SUB, {
    variables: { videoRoomId: roomId },
    onData: async () => {
      setStatus("approved");
      const res = await fetchToken();
      if (res.data?.getLiveKitToken) {
        setToken(res.data.getLiveKitToken);
        setJoined(true);
      }
    },
  });

  useSubscription(PARTICIPANT_REJECTED_SUB, {
    variables: { videoRoomId: roomId },
    onData: () => {
      setStatus("rejected");
    },
  });

  const handleJoinRequest = () => {
    setStatus("waiting");
    // Emit socket.io event to notify host
    if (meData?.me) {
      const socket = io({ path: "/socket.io" });
      // Authenticate socket.io
      const authToken = localStorage.getItem("nexchat_token");
      if (authToken) {
         socket.auth = { token: authToken };
         socket.connect();
         socket.emit("waiting:joined", { roomId, user: meData.me });
      }
    }
  };

  if (status === "rejected") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <h1 className="text-2xl text-red-500 font-semibold">Your request to join was declined.</h1>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 text-white relative">
      <WaitingRoomPanel roomId={roomId} />
      {!joined ? (
        <div className="m-auto flex flex-col items-center p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800">
          <h1 className="text-3xl font-bold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">NexChat Video</h1>
          <p className="text-gray-400 mb-8 text-center max-w-sm">
            {status === "waiting" 
              ? "Waiting for the host to let you in..." 
              : "Ready to join the video room? Make sure your camera and microphone are connected."}
          </p>
          {status !== "waiting" && (
            <button
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 transition-colors text-white rounded-full font-medium text-lg shadow-lg shadow-blue-900/20"
              onClick={handleJoinRequest}
            >
              Ask to Join
            </button>
          )}
          {status === "waiting" && (
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
      ) : (
        <LiveKitRoom
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
          token={token}
          className="flex-1 flex flex-col h-full"
          video={true}
          audio={true}
        >
          <div className="flex-1 p-4 h-[calc(100vh-80px)]">
            <GridLayout tracks={[]} className="h-full">
              <ParticipantTile />
            </GridLayout>
          </div>
          <ControlBar className="w-full bg-gray-900 border-t border-gray-800 p-4" />
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>
  );
}
