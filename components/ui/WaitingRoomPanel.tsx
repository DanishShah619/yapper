"use client";

import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Users, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useSocket } from '@/app/providers'; // Assuming this provides the global socket
import { useToast } from '@/components/ui/Toast';

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

export interface WaitingRoomPanelProps {
  roomId: string;
  onClose: () => void;
}

interface WaitingUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export function WaitingRoomPanel({ roomId, onClose }: WaitingRoomPanelProps) {
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);

  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT, {
    onError: (e) => showToast(e.message, 'error')
  });

  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT, {
    onError: (e) => showToast(e.message, 'error')
  });

  useEffect(() => {
    if (!socket) return;
    if (socket.disconnected) socket.connect();

    socket.emit('videoadmin:join', { roomId });

    const onSync = ({ users }: { roomId: string; users: WaitingUser[] }) => {
      setWaitingUsers(users);
    };

    const onJoined = ({ user }: { roomId: string; user: WaitingUser }) => {
      setWaitingUsers(prev => {
        if (prev.find(u => u.id === user.id)) return prev;
        return [...prev, user];
      });
    };

    const onLeft = ({ userId }: { userId: string }) => {
      setWaitingUsers(prev => prev.filter(u => u.id !== userId));
    };

    socket.on('waiting:sync', onSync);
    socket.on('waiting:joined', onJoined);
    socket.on('waiting:left', onLeft);

    return () => {
      socket.off('waiting:sync', onSync);
      socket.off('waiting:joined', onJoined);
      socket.off('waiting:left', onLeft);
    };
  }, [roomId, socket]);

  const handleApprove = async (participantId: string) => {
    try {
      await approveParticipant({ variables: { roomId, participantId } });
      if (socket) socket.emit('waiting:approve', { roomId, participantId });
      setWaitingUsers(prev => prev.filter(u => u.id !== participantId));
    } catch {
      // Error handled by useMutation
    }
  };

  const handleReject = async (participantId: string) => {
    try {
      await rejectParticipant({ variables: { roomId, participantId } });
      if (socket) socket.emit('waiting:reject', { roomId, participantId });
      setWaitingUsers(prev => prev.filter(u => u.id !== participantId));
    } catch {
      // Error handled by useMutation
    }
  };

  return (
    <div className="fixed bottom-24 right-4 w-72 bg-white rounded-2xl border border-[#D6E8F5] shadow-xl z-30 flex flex-col max-h-96">
      <div className="px-4 py-3 border-b border-[#D6E8F5] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#1ABC9C]" />
          <h3 className="text-sm font-bold text-[#0A0A0A]">Waiting Room</h3>
          {waitingUsers.length > 0 && (
            <span className="bg-[#D0F5EE] text-[#0A7A65] text-xs font-bold px-1.5 py-0.5 rounded-full">
              {waitingUsers.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-1 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="overflow-y-auto px-3 py-2 space-y-2 flex-1 min-h-[100px]">
        {waitingUsers.length === 0 ? (
          <div className="py-8 text-center text-xs font-medium text-[#6B7A99]">
            No one in the waiting room
          </div>
        ) : (
          waitingUsers.map(user => (
            <div key={user.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#F0F8FF]">
              <Avatar src={user.avatarUrl} name={user.username} size="sm" />
              <p className="text-sm font-bold text-[#0A0A0A] flex-1 truncate">{user.username}</p>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={() => handleApprove(user.id)}
                  className="bg-[#1ABC9C] hover:bg-[#17a589] text-white text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleReject(user.id)}
                  className="bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
