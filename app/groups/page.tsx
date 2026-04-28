"use client";

import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { Users, ChevronRight, Lock, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeletons';
import { CreateGroupModal } from '@/components/ui/CreateGroupModal';

const GET_GROUPS = gql`
  query GetGroups {
    groups {
      id name avatarUrl type locked
      members { id role }
    }
  }
`;

const ME_QUERY = gql`
  query MeGroupsPage { me { id } }
`;

export default function GroupsPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: meData, loading: meLoading, error: meError } = useQuery<{ me: { id: string } }>(ME_QUERY);
  const myId = meData?.me?.id;

  const { data, loading, error } = useQuery<{ groups: any[] }>(GET_GROUPS);
  const groups = data?.groups || [];

  const isLoading = meLoading || loading;
  const isError = meError || error;

  if (isLoading) return (
    <div className="bg-[#F0F8FF] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SkeletonList />
      </div>
    </div>
  );

  if (isError) return (
    <div className="bg-[#F0F8FF] min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-[#D6E8F5] p-8 text-center max-w-sm">
        <AlertCircle size={40} className="text-[#DC2626] mx-auto mb-3" />
        <p className="text-sm font-bold text-[#0A0A0A]">Something went wrong</p>
        <p className="text-xs font-medium text-[#6B7A99] mt-1">{isError.message}</p>
        <button className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 mt-4 w-full" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F0F8FF] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader 
          title="Groups" 
          subtitle={`${groups.length} groups`} 
          action={
            <button 
              className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150"
              onClick={() => setCreateOpen(true)}
            >
              + New Group
            </button>
          }
        />

        {loading ? (
          <SkeletonList />
        ) : groups.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title="No groups yet" 
            description="Create a group to start encrypted conversations" 
            action={
              <button 
                className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150"
                onClick={() => setCreateOpen(true)}
              >
                Create Group
              </button>
            } 
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groups.map((g: any) => {
              const myMembership = g.members.find((m: any) => m.id === myId);
              const isAdmin = myMembership?.role === 'ADMIN';

              return (
                <div 
                  key={g.id} 
                  onClick={() => router.push(`/groups/${g.id}`)}
                  className="bg-white rounded-2xl border border-[#D6E8F5] p-4 shadow-sm shadow-blue-100/50 hover:bg-[#E1F0FF] transition-colors duration-150 cursor-pointer flex items-center gap-3"
                >
                  <Avatar src={g.avatarUrl} name={g.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-bold text-[#0A0A0A] truncate">{g.name}</p>
                      {g.locked && <Lock size={12} className="text-[#6B7A99] inline ml-1 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[#6B7A99] text-xs font-medium">{g.members.length} members</p>
                      {isAdmin && (
                        <span className="bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold px-2 py-0.5 rounded-full">Admin</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#BAD9F5] shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateGroupModal 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/groups/${id}`);
        }} 
      />
    </div>
  );
}
