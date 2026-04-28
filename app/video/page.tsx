"use client";

import React from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';

const CREATE_VIDEO_ROOM = gql`
  mutation CreateVideoRoom { 
    createVideoRoom { id liveKitRoomId } 
  }
`;

export default function VideoListPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [createVideoRoom, { loading }] = useMutation(CREATE_VIDEO_ROOM, {
    onCompleted: (data: any) => {
      // Creator goes directly to the room
      router.push(`/video/${data.createVideoRoom.id}/room`);
    },
    onError: (err) => {
      showToast(err.message, 'error');
    }
  });

  const handleCreate = () => {
    createVideoRoom();
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
      </div>
    </div>
  );
}
