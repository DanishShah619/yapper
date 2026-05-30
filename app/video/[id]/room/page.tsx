"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { LiveKitRoom, VideoConference, useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Users, Unlock, Lock, PhoneOff } from 'lucide-react';
import { WaitingRoomPanel } from '@/components/ui/WaitingRoomPanel';
import { useToast } from '@/components/ui/Toast';

const GET_LIVEKIT_TOKEN = gql`
  query GetLiveKitToken($roomId: ID!) {
    getLiveKitToken(roomId: $roomId)
  }
`;

const LOCK_VIDEO_ROOM = gql`
  mutation LockVideoRoom($roomId: ID!) {
    lockVideoRoom(roomId: $roomId) { id locked }
  }
`;

const GET_VIDEO_ROOM_STATUS = gql`
  query GetVideoRoomStatus($id: ID!) {
    videoRoom(id: $id) { id locked createdBy }
  }
`;

const ME_QUERY = gql`query MeVideoRoom { me { id } }`;

// Internal controls component to access LiveKit context
type RoomControlsProps = {
  isAdmin: boolean;
  locked: boolean;
  waitingCount: number;
  onToggleWaitingPanel: () => void;
  onToggleLock: () => void;
  onDisconnect: () => void;
};

function RoomControls({ 
  isAdmin, 
  locked, 
  waitingCount, 
  onToggleWaitingPanel, 
  onToggleLock, 
  onDisconnect 
}: RoomControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const { showToast } = useToast();

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  };

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!cameraOn);
    setCameraOn(!cameraOn);
  };

  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!sharing);
      setSharing(!sharing);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Screen share failed or already in progress", "error");
    }
  };

  return (
    <div className="bg-[#111111]/90 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-center gap-4 shrink-0 absolute bottom-0 left-0 right-0 z-20">
      <button 
        onClick={toggleMic}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-[#1F2937] hover:bg-[#374151] text-white' : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'}`}
      >
        {micOn ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button 
        onClick={toggleCamera}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${cameraOn ? 'bg-[#1F2937] hover:bg-[#374151] text-white' : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'}`}
      >
        {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      <button 
        onClick={toggleScreenShare}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${sharing ? 'bg-[#1ABC9C] hover:bg-[#17a589] text-white' : 'bg-[#1F2937] hover:bg-[#374151] text-white'}`}
      >
        {sharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
      </button>

      {isAdmin && (
        <>
          <button 
            onClick={onToggleWaitingPanel}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-[#1F2937] hover:bg-[#374151] text-white transition-colors relative"
          >
            <Users size={20} />
            {waitingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1ABC9C] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {waitingCount}
              </span>
            )}
          </button>

          <button 
            onClick={onToggleLock}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${locked ? 'bg-[#7C3AED] text-white' : 'bg-[#1F2937] text-white'}`}
          >
            {locked ? <Lock size={20} /> : <Unlock size={20} />}
          </button>
        </>
      )}

      <button 
        onClick={onDisconnect}
        className="w-11 h-11 rounded-full flex items-center justify-center bg-[#DC2626] hover:bg-[#B91C1C] text-white transition-colors ml-2"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
}

export default function VideoRoomPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { showToast } = useToast();

  const [waitingPanelOpen, setWaitingPanelOpen] = useState(false);
  const waitingCount = 0; // This would be synced via socket in a real app or within the panel

  const { data: meData } = useQuery<{ me: { id: string } }>(ME_QUERY);
  const { data: statusData, refetch: refetchStatus } = useQuery<{
    videoRoom: { id: string; locked: boolean; createdBy: string } | null;
  }>(GET_VIDEO_ROOM_STATUS, { variables: { id } });
  
  const [lockVideoRoom] = useMutation(LOCK_VIDEO_ROOM, {
    onCompleted: () => {
      refetchStatus();
      showToast(statusData?.videoRoom?.locked ? "Room unlocked" : "Room locked", "success");
    },
    onError: (e) => showToast(e.message, "error")
  });

  const { data: tokenData, loading: tokenLoading, error: tokenError } = useQuery<{ getLiveKitToken: string }>(GET_LIVEKIT_TOKEN, { 
    variables: { roomId: id }
  });

  if (tokenLoading) return <div className="h-screen bg-[#0A0A0A] flex items-center justify-center text-white">Connecting...</div>;
  if (tokenError) return <div className="h-screen bg-[#0A0A0A] flex items-center justify-center text-[#DC2626]">{tokenError.message}</div>;

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";
  const token = tokenData?.getLiveKitToken;

  const isAdmin = statusData?.videoRoom?.createdBy === meData?.me?.id;
  const isLocked = statusData?.videoRoom?.locked || false;

  const handleDisconnect = () => {
    router.push('/video');
  };

  return (
    <div className="flex flex-col bg-[#0A0A0A] h-screen relative">
      <div className="flex-1 overflow-hidden">
        {token ? (
          <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            onDisconnected={handleDisconnect}
            className="h-full"
          >
            <VideoConference />
            <RoomControls 
              isAdmin={isAdmin}
              locked={isLocked}
              waitingCount={waitingCount}
              onToggleWaitingPanel={() => setWaitingPanelOpen(!waitingPanelOpen)}
              onToggleLock={() => lockVideoRoom({ variables: { roomId: id } })}
              onDisconnect={() => router.push('/video')}
            />
          </LiveKitRoom>
        ) : (
          <div className="flex items-center justify-center h-full text-white">No token available</div>
        )}
      </div>

      {isAdmin && waitingPanelOpen && (
        <WaitingRoomPanel 
          roomId={id} 
          onClose={() => setWaitingPanelOpen(false)} 
        />
      )}
    </div>
  );
}
