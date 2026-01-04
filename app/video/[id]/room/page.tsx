"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { GridLayout, LiveKitRoom, ParticipantTile, RoomAudioRenderer, useLocalParticipant, useTracks } from '@livekit/components-react';
import { RoomOptions, Track } from 'livekit-client';
import { Copy, Link, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Users, Unlock, Lock, PhoneOff } from 'lucide-react';
import { WaitingRoomPanel } from '@/components/ui/WaitingRoomPanel';
import { InCallInvitePanel } from '@/components/ui/InCallInvitePanel';
import { useToast } from '@/components/ui/Toast';
import { useSocket } from '@/app/providers';

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

const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: true,
  },
};

function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <GridLayout
      tracks={tracks}
      style={{ height: "calc(100vh - 80px)", width: "100%" }}
    >
      <ParticipantTile />
    </GridLayout>
  );
}

// Internal controls component to access LiveKit context
type RoomControlsProps = {
  isAdmin: boolean;
  invitePanelOpen: boolean;
  locked: boolean;
  waitingCount: number;
  onToggleInvitePanel: () => void;
  onToggleWaitingPanel: () => void;
  onToggleLock: () => void;
  onDisconnect: () => void;
};

function RoomControls({ 
  isAdmin, 
  invitePanelOpen,
  locked, 
  waitingCount, 
  onToggleInvitePanel,
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
    <div className="shrink-0 bg-[#111111]/90 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-center gap-4">
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
            onClick={onToggleInvitePanel}
            title="Send invite link"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${invitePanelOpen ? 'bg-[#1ABC9C] text-white' : 'bg-[#1F2937] hover:bg-[#374151] text-white'}`}
          >
            <Link size={18} />
          </button>

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
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [waitingPanelOpen, setWaitingPanelOpen] = useState(false);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [waitingUserIds, setWaitingUserIds] = useState<string[]>([]);

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

  const roomInfo = statusData?.videoRoom;
  const isAdmin = roomInfo?.createdBy === meData?.me?.id;
  const isLocked = roomInfo?.locked || false;
  const waitingCount = waitingUserIds.length;

  useEffect(() => {
    if (!socket || !isAdmin) return;
    if (socket.disconnected) socket.connect();

    socket.emit('videoadmin:join', { roomId: id });

    const onSync = ({ users }: { roomId: string; users: { id: string }[] }) => {
      setWaitingUserIds(users.map((user) => user.id));
    };

    const onJoined = ({ user }: { roomId: string; user: { id: string } }) => {
      setWaitingUserIds((prev) => {
        if (prev.includes(user.id)) return prev;
        return [...prev, user.id];
      });
    };

    const onLeft = ({ userId }: { roomId: string; userId: string }) => {
      setWaitingUserIds((prev) => prev.filter((id) => id !== userId));
    };

    socket.on('waiting:sync', onSync);
    socket.on('waiting:joined', onJoined);
    socket.on('waiting:left', onLeft);

    return () => {
      socket.off('waiting:sync', onSync);
      socket.off('waiting:joined', onJoined);
      socket.off('waiting:left', onLeft);
    };
  }, [id, isAdmin, socket]);

  if (tokenLoading) return <div className="h-screen bg-[#0A0A0A] flex items-center justify-center text-white">Connecting...</div>;
  if (tokenError) return <div className="h-screen bg-[#0A0A0A] flex items-center justify-center text-[#DC2626]">{tokenError.message}</div>;

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const token = tokenData?.getLiveKitToken;
  const joinUrl = typeof window === 'undefined' ? `/video/${id}/waiting` : `${window.location.origin}/video/${id}/waiting`;

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`, 'success');
    } catch {
      showToast(`Could not copy ${label.toLowerCase()}`, 'error');
    }
  };

  const handleDisconnect = () => {
    router.push(searchParams.get('returnTo') ?? '/video');
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
            connect={true}
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            options={roomOptions}
            onDisconnected={handleDisconnect}
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-hidden relative">
              <VideoGrid />
            </div>
            <RoomAudioRenderer />
            {invitePanelOpen && isAdmin && (
              <InCallInvitePanel
                videoRoomId={id}
                onClose={() => setInvitePanelOpen(false)}
              />
            )}
            <RoomControls 
              isAdmin={isAdmin}
              invitePanelOpen={invitePanelOpen}
              locked={isLocked}
              waitingCount={waitingCount}
              onToggleInvitePanel={() => setInvitePanelOpen((open) => !open)}
              onToggleWaitingPanel={() => setWaitingPanelOpen(!waitingPanelOpen)}
              onToggleLock={() => lockVideoRoom({ variables: { roomId: id } })}
              onDisconnect={handleDisconnect}
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
