"use client";

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { X, Lock, Unlock, Link as LinkIcon, UserPlus, LogOut, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { getAccountKeyPair, getGroupRoomKey, wrapGroupKeyForNewMember } from '@/lib/e2ee';

const LOCK_GROUP = gql`mutation LockGroup($groupId: ID!) { lockGroup(groupId: $groupId) { id locked } }`;
const UNLOCK_GROUP = gql`mutation UnlockGroup($groupId: ID!) { unlockGroup(groupId: $groupId) { id locked } }`;
const GENERATE_INVITE = gql`mutation GenerateInviteLink($groupId: ID!, $ttl: Int!) { generateInviteLink(groupId: $groupId, ttl: $ttl) { url } }`;
const LEAVE_GROUP = gql`mutation LeaveGroup($groupId: ID!) { leaveGroup(groupId: $groupId) }`;
const DELETE_GROUP = gql`mutation DeleteGroup($groupId: ID!) { deleteGroup(groupId: $groupId) }`;
const GET_CONNECTIONS = gql`
  query GetConnectionsForGroupAdd {
    connections { id username avatarUrl publicKey }
  }
`;
const ADD_GROUP_MEMBER = gql`
  mutation AddGroupMember($groupId: ID!, $username: String!, $encryptedKey: String) {
    addGroupMember(groupId: $groupId, username: $username, encryptedKey: $encryptedKey) {
      id
      user { id username avatarUrl publicKey }
      role
      encryptedKey
    }
  }
`;
const SUBMIT_GROUP_KEYS = gql`
  mutation SubmitGroupKeys($groupId: ID!, $wrappedKeys: [WrappedKeyInput!]!) {
    submitRotatedGroupKeys(groupId: $groupId, wrappedKeys: $wrappedKeys)
  }
`;

type GenerateInviteData = {
  generateInviteLink: {
    url: string;
  };
};

type ConnectionNode = {
  id: string;
  username: string;
  avatarUrl: string | null;
  publicKey: string | null;
};

type GroupMemberNode = {
  role?: string;
  encryptedKey?: string | null;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    publicKey?: string | null;
  };
};

type AddGroupMemberData = {
  addGroupMember: GroupMemberNode;
};

export interface GroupSettingsPanelProps {
  group: {
    id: string;
    name: string;
    avatarUrl: string | null;
    locked: boolean;
    type: string;
    createdBy?: string;
    members?: GroupMemberNode[];
  };
  isAdmin: boolean;
  currentUserId?: string;
  currentUserPublicKey?: string | null;
  onClose: () => void;
  open: boolean;
  onRefresh: () => void;
}

export function GroupSettingsPanel({ group, isAdmin, currentUserId, currentUserPublicKey, onClose, open, onRefresh }: GroupSettingsPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [addUsername, setAddUsername] = useState('');
  const [memberSearchFocused, setMemberSearchFocused] = useState(false);
  const [deliveringKey, setDeliveringKey] = useState(false);
  const { data: connectionsData } = useQuery<{ connections: ConnectionNode[] }>(GET_CONNECTIONS, {
    skip: !isAdmin || !open,
  });

  const [lockGroup] = useMutation(LOCK_GROUP, { onCompleted: onRefresh, onError: (e) => showToast(e.message, 'error') });
  const [unlockGroup] = useMutation(UNLOCK_GROUP, { onCompleted: onRefresh, onError: (e) => showToast(e.message, 'error') });
  const [generateInvite] = useMutation<GenerateInviteData>(GENERATE_INVITE, {
    onCompleted: (data) => {
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
  const [submitGroupKeys] = useMutation(SUBMIT_GROUP_KEYS);
  const [addGroupMember, { loading: addingMember }] = useMutation<AddGroupMemberData>(ADD_GROUP_MEMBER, {
    onCompleted: () => {
      setAddUsername('');
      onRefresh();
      showToast('Member added', 'success');
    },
    onError: (e) => showToast(e.message, 'error')
  });

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCreator = currentUserId === group.createdBy;
  const existingMemberIds = useMemo(
    () => new Set((group.members ?? []).map((member) => member.user.id)),
    [group.members]
  );
  const availableConnections = useMemo(() => {
    const query = addUsername.trim().toLowerCase();

    const scoreUsername = (username: string) => {
      const value = username.toLowerCase();
      if (!query) return 1;
      if (value === query) return 100;
      if (value.startsWith(query)) return 80 - (value.length - query.length);
      if (value.includes(query)) return 60 - value.indexOf(query);

      let queryIndex = 0;
      let score = 0;
      for (let valueIndex = 0; valueIndex < value.length && queryIndex < query.length; valueIndex += 1) {
        if (value[valueIndex] === query[queryIndex]) {
          queryIndex += 1;
          score += 2;
        }
      }

      return queryIndex === query.length ? score : 0;
    };

    return (connectionsData?.connections ?? [])
      .filter((connection) => !existingMemberIds.has(connection.id))
      .map((connection) => ({ connection, score: scoreUsername(connection.username) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.connection.username.localeCompare(b.connection.username))
      .slice(0, 6)
      .map(({ connection }) => connection);
  }, [addUsername, connectionsData?.connections, existingMemberIds]);

  const handleAddMember = async () => {
    const username = addUsername.trim();
    if (!username) return;

    const selectedConnection = (connectionsData?.connections ?? []).find(
      (connection) => connection.username.toLowerCase() === username.toLowerCase()
    );

    if (!currentUserId) {
      showToast('Your session is still loading. Try again in a moment.', 'error');
      return;
    }

    if (!selectedConnection?.publicKey) {
      showToast('This member has not set up encryption yet, so the group key cannot be delivered.', 'error');
      return;
    }

    setDeliveringKey(true);
    try {
      const { roomKey, wrappedKeys } = await getGroupRoomKey(
        group.id,
        group.members ?? [],
        currentUserId,
        currentUserPublicKey,
        { allowInitialize: true }
      );

      if (wrappedKeys.length > 0) {
        await submitGroupKeys({ variables: { groupId: group.id, wrappedKeys } });
      }

      const { privateKey } = await getAccountKeyPair(currentUserId, currentUserPublicKey);
      const encryptedKey = await wrapGroupKeyForNewMember(
        roomKey,
        selectedConnection.publicKey,
        privateKey
      );

      await addGroupMember({ variables: { groupId: group.id, username, encryptedKey } });
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : 'Member could not be added with a delivered group key.',
        'error'
      );
    } finally {
      setDeliveringKey(false);
    }
  };

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
                <div className="px-4 py-3 rounded-xl bg-[#F0F8FF] border border-[#D6E8F5]">
                  <div className="flex items-center gap-2 text-[#1A3A6B] mb-2">
                    <UserPlus size={18} />
                    <span className="text-sm font-semibold">Add Member</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        className="w-full rounded-lg border border-[#D6E8F5] bg-white px-3 py-2 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF]"
                        placeholder="Search connections"
                        value={addUsername}
                        onChange={(event) => setAddUsername(event.target.value)}
                        onFocus={() => setMemberSearchFocused(true)}
                        onBlur={() => setMemberSearchFocused(false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddMember();
                          }
                        }}
                        disabled={addingMember || deliveringKey}
                      />
                      {memberSearchFocused && availableConnections.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#D6E8F5] bg-white shadow-xl z-50">
                          {availableConnections.map((connection) => (
                            <button
                              key={connection.id}
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#E1F0FF] transition-colors"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setAddUsername(connection.username);
                              }}
                            >
                              <Avatar src={connection.avatarUrl} name={connection.username} size="sm" />
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0A0A0A]">
                                {connection.username}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="rounded-lg bg-[#1ABC9C] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#17a589] disabled:opacity-50"
                      onClick={handleAddMember}
                      disabled={addingMember || deliveringKey || addUsername.trim().length === 0}
                    >
                      Add
                    </button>
                  </div>
                </div>
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
