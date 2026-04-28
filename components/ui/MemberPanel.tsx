"use client";

import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { X, MoreVertical } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const PROMOTE_MEMBER = gql`
  mutation PromoteGroupMember($groupId: ID!, $userId: ID!) {
    promoteGroupMember(groupId: $groupId, userId: $userId) { id }
  }
`;

const REMOVE_MEMBER = gql`
  mutation RemoveGroupMember($groupId: ID!, $userId: ID!) {
    removeGroupMember(groupId: $groupId, userId: $userId)
  }
`;

export interface MemberPanelProps {
  groupId: string;
  members: Array<{ id: string; username: string; avatarUrl: string | null; role: "ADMIN" | "MEMBER" }>;
  isAdmin: boolean;
  currentUserId?: string;
  onClose: () => void;
  open: boolean;
  onRefresh: () => void;
}

export function MemberPanel({ groupId, members, isAdmin, currentUserId, onClose, open, onRefresh }: MemberPanelProps) {
  const { showToast } = useToast();
  
  const [promoteMember] = useMutation(PROMOTE_MEMBER, {
    onCompleted: () => {
      onRefresh();
      showToast("Member promoted to Admin", "success");
    },
    onError: (err) => showToast(err.message, "error")
  });

  const [removeMember] = useMutation(REMOVE_MEMBER, {
    onCompleted: () => {
      onRefresh();
      showToast("Member removed", "success");
      setConfirmUserId(null);
    },
    onError: (err) => {
      showToast(err.message, "error");
      setConfirmUserId(null);
    }
  });

  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

  return (
    <>
      <div 
        className={`fixed right-0 top-0 h-full w-full sm:w-72 bg-white border-l border-[#D6E8F5] shadow-xl z-40 transform transition-transform duration-200 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-4 py-4 border-b border-[#D6E8F5] flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#0A0A0A]">Members ({members.length})</h3>
          <button onClick={onClose} className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-1.5 transition-colors duration-150">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
          {members.map(member => {
            const isMe = member.id === currentUserId;
            return (
              <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#E1F0FF] group/row transition-colors duration-150">
                <Avatar src={member.avatarUrl} name={member.username} size="sm" />
                <p className="text-sm font-bold text-[#0A0A0A] flex-1 truncate">
                  {member.username} {isMe && <span className="text-xs font-normal text-[#6B7A99] ml-1">(You)</span>}
                </p>
                
                {member.role === 'ADMIN' ? (
                  <span className="bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold px-2 py-0.5 rounded-full">Admin</span>
                ) : (
                  <span className="bg-[#F0F8FF] text-[#6B7A99] text-xs font-semibold px-2 py-0.5 rounded-full">Member</span>
                )}

                {isAdmin && !isMe && (
                  <div className="relative group/menu">
                    <button className="hover:bg-[#BAD9F5] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-1 transition-colors duration-150">
                      <MoreVertical size={16} />
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-[#D6E8F5] rounded-xl shadow-xl w-40 hidden group-hover/menu:block z-50">
                      {member.role === 'MEMBER' && (
                        <button 
                          className="w-full text-left px-4 py-2 text-sm font-semibold text-[#0A0A0A] hover:bg-[#E1F0FF] rounded-t-xl transition-colors duration-150"
                          onClick={() => promoteMember({ variables: { groupId, userId: member.id } })}
                        >
                          Promote to Admin
                        </button>
                      )}
                      <button 
                        className={`w-full text-left px-4 py-2 text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors duration-150 ${member.role === 'ADMIN' ? 'rounded-xl' : 'rounded-b-xl'}`}
                        onClick={() => setConfirmUserId(member.id)}
                      >
                        Remove from Group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog 
        open={confirmUserId !== null}
        title="Remove Member"
        description="Are you sure you want to remove this member from the group?"
        confirmLabel="Remove"
        confirmVariant="danger"
        onCancel={() => setConfirmUserId(null)}
        onConfirm={() => {
          if (confirmUserId) {
            removeMember({ variables: { groupId, userId: confirmUserId } });
          }
        }}
      />
    </>
  );
}
