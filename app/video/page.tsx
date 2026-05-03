"use client";

import React, { useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { LogIn, Video } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';

const CREATE_VIDEO_ROOM = gql`
  mutation CreateVideoRoom { 
    createVideoRoom { id liveKitRoomId } 
  }
`;

const GET_VIDEO_ROOM = gql`
  query JoinVideoRoom($id: ID!) {
    videoRoom(id: $id) { id locked }
  }
`;

type CreateVideoRoomData = {
  createVideoRoom: {
    id: string;
    liveKitRoomId: string | null;
  };
};

type VideoRoomLookupData = {
  videoRoom: {
    id: string;
    locked: boolean;
  } | null;
};

export default function VideoListPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [roomId, setRoomId] = useState('');

  const [createVideoRoom, { loading }] = useMutation<CreateVideoRoomData>(CREATE_VIDEO_ROOM, {
    onCompleted: (data) => {
      // Creator goes directly to the room
      router.push(`/video/${data.createVideoRoom.id}/room`);
    },
    onError: (err) => {
      showToast(err.message, 'error');
    }
  });

  const [lookupVideoRoom, { loading: joining }] = useLazyQuery<VideoRoomLookupData>(GET_VIDEO_ROOM, {
    fetchPolicy: 'network-only',
  });

  const handleCreate = () => {
    createVideoRoom();
  };

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = roomId.trim();

    if (!trimmed) {
      showToast('Enter a room ID to join', 'error');
      return;
    }

    try {
      const result = await lookupVideoRoom({ variables: { id: trimmed } });

      if (!result.data?.videoRoom) {
        showToast('No video room found for that ID', 'error');
        return;
      }

      router.push(`/video/${trimmed}/waiting`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not join that room', 'error');
    }
  };

  return (
    <div className="bg-[#F0F8FF] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader 
          title="Video Calls" 
          subtitle="Start or join encrypted video calls" 
          action={
            <button 
              className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating...' : '+ New Call'}
            </button>
          }
        />

        <div className="bg-[#E1F0FF] border border-[#BAD9F5] rounded-2xl p-4 flex items-start">
          <Video size={20} className="text-[#1A3A6B] inline mr-3 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-[#1A3A6B]">
            Calls are end-to-end encrypted via LiveKit. Maximum 4 participants per call.
          </p>
        </div>

        <form
          onSubmit={handleJoin}
          className="mt-4 bg-white border border-[#D6E8F5] rounded-2xl p-4 shadow-sm"
        >
          <label htmlFor="video-room-id" className="block text-sm font-bold text-[#0A0A0A]">
            Join by room ID
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="video-room-id"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="Paste a video room ID"
              className="min-w-0 flex-1 rounded-lg border border-[#D6E8F5] bg-[#F0F8FF] px-3 py-2 text-sm font-medium text-[#0A0A0A] outline-none transition-colors placeholder:text-[#6B7A99] focus:border-[#1ABC9C] focus:ring-2 focus:ring-[#D0F5EE]"
            />
            <button
              type="submit"
              disabled={joining}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A3A6B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#102A4D] disabled:opacity-50"
            >
              <LogIn size={16} />
              {joining ? 'Checking...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
