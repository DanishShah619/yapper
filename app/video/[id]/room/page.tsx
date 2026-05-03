"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { LiveKitRoom, VideoConference, useLocalParticipant } from '@livekit/components-react';
import { Copy, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Users, Unlock, Lock, PhoneOff } from 'lucide-react';
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
    videoRoom(id: $id) { id locked createdBy liveKitRoomId maxParticipants }
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
    videoRoom: {
      id: string;
      locked: boolean;
      createdBy: string;
      liveKitRoomId: string | null;
      maxParticipants: number;
    } | null;
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
  const roomInfo = statusData?.videoRoom;
  const joinUrl = typeof window === 'undefined' ? `/video/${id}/waiting` : `${window.location.origin}/video/${id}/waiting`;

  const isAdmin = roomInfo?.createdBy === meData?.me?.id;
  const isLocked = roomInfo?.locked || false;

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`, 'success');
    } catch {
      showToast(`Could not copy ${label.toLowerCase()}`, 'error');
    }
  };

  const handleDisconnect = () => {
    router.push('/video');
  };

  return (
    <div className="flex flex-col bg-[#0A0A0A] h-screen relative">
      <div className="absolute left-4 right-4 top-4 z-30 rounded-xl border border-white/10 bg-[#111111]/85 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#1ABC9C]">Video room</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isLocked ? 'bg-[#7C3AED] text-white' : 'bg-[#D0F5EE] text-[#0A7A65]'}`}>
                {isLocked ? 'Locked' : 'Open'}
              </span>
              {isAdmin && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
                  Host
                </span>
              )}
            </div>
            <div className="mt-2 grid gap-1 text-xs font-medium text-white/75 md:grid-cols-2">
              <p className="truncate">
                Room ID: <span className="font-mono text-white">{id}</span>
              </p>
              <p className="truncate">
                LiveKit ID: <span className="font-mono text-white">{roomInfo?.liveKitRoomId ?? 'Pending'}</span>
              </p>
              <p className="truncate">
                Join URL: <span className="font-mono text-white">{joinUrl}</span>
              </p>
              <p>
                Limit: <span className="text-white">{roomInfo?.maxParticipants ?? 4} participants</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(id, 'Room ID')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              <Copy size={14} />
              Room ID
            </button>
            <button
              type="button"
              onClick={() => copyText(joinUrl, 'Join URL')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ABC9C] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#17a589]"
            >
              <Copy size={14} />
              Join URL
            </button>
          </div>
        </div>
      </div>
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
