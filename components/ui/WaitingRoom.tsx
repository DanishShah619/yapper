"use client";

import { useState, useEffect } from "react";
import { useMutation, gql } from "@apollo/client";
import { io } from "socket.io-client";
import { Check, X, Users } from "lucide-react";

const APPROVE_PARTICIPANT = gql`
  mutation ApproveParticipant($roomId: ID!, $participantId: ID!) {
    approveParticipant(roomId: $roomId, participantId: $participantId)
  }
`;

const REJECT_PARTICIPANT = gql`
  mutation RejectParticipant($roomId: ID!, $participantId: ID!) {
    rejectParticipant(roomId: $roomId, participantId: $participantId)
  }
`;

type Participant = {
  id: string;
  username: string;
};

export default function WaitingRoomPanel({ roomId }: { roomId: string }) {
  const [waiting, setWaiting] = useState<Participant[]>([]);
  const [approve] = useMutation(APPROVE_PARTICIPANT);
  const [reject] = useMutation(REJECT_PARTICIPANT);

  useEffect(() => {
    const token = localStorage.getItem("nexchat_token");
    if (!token) return;

    const socket = io({ path: "/socket.io" });
    socket.auth = { token };
    socket.connect();

    socket.emit("videoadmin:join", { roomId });

    socket.on("waiting:joined", ({ user }: { user: Participant }) => {
      setWaiting((prev) => {
        if (prev.find((p) => p.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  if (waiting.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 w-80 bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="flex items-center px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
        <Users className="w-5 h-5 text-blue-400 mr-2" />
        <h3 className="font-semibold text-white">Waiting Room</h3>
        <span className="ml-auto bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full">
          {waiting.length}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {waiting.map((user) => (
          <div key={user.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-800/50 transition-colors group">
            <span className="text-gray-200 font-medium truncate pr-4">{user.username}</span>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  approve({ variables: { roomId, participantId: user.id } });
                  setWaiting((prev) => prev.filter((p) => p.id !== user.id));
                }}
                className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                title="Approve"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  reject({ variables: { roomId, participantId: user.id } });
                  setWaiting((prev) => prev.filter((p) => p.id !== user.id));
                }}
                className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Reject"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
