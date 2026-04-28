"use client";

import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { X, Lock, Unlock, Link as LinkIcon, UserPlus, LogOut, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const LOCK_GROUP = gql`mutation LockGroup($groupId: ID!) { lockGroup(groupId: $groupId) { id locked } }`;
const UNLOCK_GROUP = gql`mutation UnlockGroup($groupId: ID!) { unlockGroup(groupId: $groupId) { id locked } }`;
const GENERATE_INVITE = gql`mutation GenerateInviteLink($groupId: ID!, $ttl: Int!) { generateInviteLink(groupId: $groupId, ttl: $ttl) { url } }`;
const LEAVE_GROUP = gql`mutation LeaveGroup($groupId: ID!) { leaveGroup(groupId: $groupId) }`;
const DELETE_GROUP = gql`mutation DeleteGroup($groupId: ID!) { deleteGroup(groupId: $groupId) }`;

export interface GroupSettingsPanelProps {
  group: { id: string; name: string; avatarUrl: string | null; locked: boolean; type: string; createdBy?: string };
  isAdmin: boolean;
  currentUserId?: string;
  onClose: () => void;
  open: boolean;
  onRefresh: () => void;
}

export function GroupSettingsPanel({ group, isAdmin, currentUserId, onClose, open, onRefresh }: GroupSettingsPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [lockGroup] = useMutation(LOCK_GROUP, { onCompleted: onRefresh, onError: (e) => showToast(e.message, 'error') });
  const [unlockGroup] = useMutation(UNLOCK_GROUP, { onCompleted: onRefresh, onError: (e) => showToast(e.message, 'error') });
  const [generateInvite] = useMutation(GENERATE_INVITE, {
    onCompleted: (data: any) => {
      const fullUrl = `${window.location.origin}${data.generateInviteLink.url}`;
      navigator.clipboard.writeText(fullUrl);
      showToast("Link copied!", "success");
    },
    onError: (e) => showToast(e.message, 'error')
  });

  const [leaveGroup] = useMutation(LEAVE_GROUP, {
    onCompleted: () => router.push('/groups'),
    onError: (e) => showToast(e.message, 'error')
  });
  const [deleteGroup] = useMutation(DELETE_GROUP, {
    onCompleted: () => router.push('/groups'),
    onError: (e) => showToast(e.message, 'error')
  });

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCreator = currentUserId === group.createdBy;

  return (
    <>
      <div className={`fixed right-0 top-0 h-full w-full sm:w-72 bg-white border-l border-[#D6E8F5] shadow-xl z-40 transform transition-transform duration-200 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-4 py-4 border-b border-[#D6E8F5] flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#0A0A0A]">Settings</h3>
          <button onClick={onClose} className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-1.5 transition-colors duration-150">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 border-b border-[#D6E8F5] flex flex-col items-center">
            <Avatar src={group.avatarUrl} name={group.name} size="lg" />
            <h3 className="text-base font-bold text-[#0A0A0A] text-center mt-2">{group.name}</h3>
            <div className="mt-2">
              {group.type === 'PERSISTENT' ? (
                <span className="bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold px-2 py-0.5 rounded-full">Persistent</span>
              ) : (
                <span className="bg-[#FFF3CD] text-[#7A5900] text-xs font-semibold px-2 py-0.5 rounded-full">Ephemeral</span>
              )}
            </div>
          </div>

          <div className="p-3 space-y-1">
            {isAdmin && (
              <>
                <button 
                  onClick={() => group.locked ? unlockGroup({ variables: { groupId: group.id } }) : lockGroup({ variables: { groupId: group.id } })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] transition-colors duration-150"
                >
                  {group.locked ? <Unlock size={18} /> : <Lock size={18} />}
                  <span className="text-sm font-semibold">{group.locked ? 'Unlock Group' : 'Lock Group'}</span>
                </button>
                <button 
                  onClick={() => generateInvite({ variables: { groupId: group.id, ttl: 86400 } })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] transition-colors duration-150"
                >
                  <LinkIcon size={18} />
                  <span className="text-sm font-semibold">Copy Invite Link</span>
                </button>
                <button 
                  onClick={() => showToast("Add member search UI is a V2 feature", "info")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] transition-colors duration-150"
                >
                  <UserPlus size={18} />
                  <span className="text-sm font-semibold">Add Member</span>
                </button>
              </>
            )}

            <button 
              onClick={() => setConfirmLeave(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] font-semibold transition-colors duration-150 mt-4"
            >
              <LogOut size={18} />
              <span className="text-sm">Leave Group</span>
            </button>

            {isCreator && (
              <button 
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] font-semibold transition-colors duration-150"
              >
                <Trash2 size={18} />
                <span className="text-sm">Delete Group</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog 
        open={confirmLeave}
        title="Leave Group"
        description="Are you sure you want to leave this group?"
        confirmLabel="Leave"
        confirmVariant="danger"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => leaveGroup({ variables: { groupId: group.id } })}
      />

      <ConfirmDialog 
        open={confirmDelete}
        title="Delete Group"
        description="This will permanently delete the group and all its history for everyone. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteGroup({ variables: { groupId: group.id } })}
      />
    </>
  );
}
