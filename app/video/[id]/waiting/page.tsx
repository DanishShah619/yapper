"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Video, XCircle, Lock } from 'lucide-react';
import { useSocket } from '@/app/providers'; // Assuming this exists or using socket directly

const GET_VIDEO_ROOM = gql`
  query GetVideoRoom($id: ID!) {
    videoRoom(id: $id) { id locked liveKitRoomId }
  }
`;

type WaitingState = 'WAITING' | 'REJECTED' | 'LOCKED';

export default function WaitingRoomPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { socket } = useSocket() as any; // Need to ensure useSocket is available, or use global window.socket if implemented that way.

  const { data, loading } = useQuery<{ videoRoom: any }>(GET_VIDEO_ROOM, { variables: { id } });
  const [roomState, setRoomState] = useState<WaitingState>('WAITING');

  useEffect(() => {
    if (data?.videoRoom?.locked) {
      setRoomState('LOCKED');
    }
  }, [data]);

  useEffect(() => {
    if (!socket || roomState !== 'WAITING') return;

    socket.emit('waiting:join', { roomId: id });

    const onApproved = () => {
      router.push(`/video/${id}/room`);
    };

    const onRejected = () => {
      setRoomState('REJECTED');
    };

    socket.on('waiting:approved', onApproved);
    socket.on('waiting:rejected', onRejected);

    return () => {
      socket.off('waiting:approved', onApproved);
      socket.off('waiting:rejected', onRejected);
      if (roomState === 'WAITING') {
        socket.emit('waiting:leave', { roomId: id });
      }
    };
  }, [socket, id, router, roomState]);

  const handleLeave = () => {
    if (socket) socket.emit('waiting:leave', { roomId: id });
    router.push('/video');
  };

  if (loading) return <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0F8FF]">
      <div className="bg-white rounded-2xl border border-[#D6E8F5] shadow-sm p-10 max-w-sm w-full mx-4 text-center">
        
        {roomState === 'WAITING' && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-[#D0F5EE] animate-ping opacity-60"></div>
              <div className="relative w-20 h-20 rounded-full bg-[#E1F0FF] flex items-center justify-center z-10">
                <Video size={32} className="text-[#1ABC9C]" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-[#0A0A0A] mt-2">Waiting for host</h2>
            <p className="text-sm font-medium text-[#6B7A99] mt-1 max-w-xs mx-auto">
              You'll be admitted once the host approves your request
            </p>
            <button 
              onClick={handleLeave}
              className="bg-[#E1F0FF] hover:bg-[#BAD9F5] text-[#1A3A6B] font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 mt-8"
            >
              Leave
            </button>
          </>
        )}

        {roomState === 'REJECTED' && (
          <>
            <XCircle size={48} className="text-[#DC2626] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-[#0A0A0A]">Request declined</h2>
            <p className="text-sm font-medium text-[#6B7A99] mt-1">
              The host declined your request to join
            </p>
            <button 
              onClick={() => router.push('/video')}
              className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 mt-8"
            >
              Back to Video Calls
            </button>
          </>
        )}

        {roomState === 'LOCKED' && (
          <>
            <Lock size={48} className="text-[#BAD9F5] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-[#0A0A0A]">Room is locked</h2>
            <p className="text-sm font-medium text-[#6B7A99] mt-1">
              This room is not accepting new participants
            </p>
            <button 
              onClick={() => router.push('/video')}
              className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 mt-8"
            >
              Back to Video Calls
            </button>
          </>
        )}

      </div>
    </div>
  );
}
