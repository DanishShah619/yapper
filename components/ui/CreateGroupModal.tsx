"use client";

import React, { useState } from 'react';

export interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

// Since CreateGroupModal uses useMutation, it needs to import it
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { generateAndStoreGroupKey } from '@/lib/e2ee';

const CREATE_GROUP = gql`
  mutation CreateGroup($name: String!, $type: RoomType!) {
    createGroup(name: $name, type: $type) { id name }
  }
`;

type RoomType = 'PERSISTENT' | 'EPHEMERAL';

type CreateGroupData = {
  createGroup: {
    id: string;
    name: string;
  };
};

export function CreateGroupModal({ open, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('PERSISTENT');

  const [createGroup, { loading }] = useMutation<CreateGroupData>(CREATE_GROUP, {
    onCompleted: async (data) => {
      await generateAndStoreGroupKey(data.createGroup.id);
      onCreated(data.createGroup.id);
      onClose();
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-[#D6E8F5] shadow-xl">
        <h3 className="text-lg font-bold text-[#0A0A0A] mb-4">New Group</h3>
        
        <div>
          <label className="block text-[#6B7A99] text-xs font-semibold uppercase tracking-wide mb-1">Group Name</label>
          <input 
            type="text"
            className="w-full bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl px-4 py-2.5 text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99] focus:outline-none focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF]"
            placeholder="e.g. Design Team"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="mt-4">
          <label className="block text-[#6B7A99] text-xs font-semibold uppercase tracking-wide mb-2">Message History</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType('PERSISTENT')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 ${type === 'PERSISTENT' ? 'bg-[#BAD9F5] text-[#0A0A0A]' : 'bg-[#E1F0FF] text-[#1A3A6B] hover:bg-[#BAD9F5]'}`}
            >
              Persistent
            </button>
            <button
              onClick={() => setType('EPHEMERAL')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 ${type === 'EPHEMERAL' ? 'bg-[#BAD9F5] text-[#0A0A0A]' : 'bg-[#E1F0FF] text-[#1A3A6B] hover:bg-[#BAD9F5]'}`}
            >
              Ephemeral
            </button>
          </div>
          <p className="mt-2 text-xs text-[#6B7A99]">
            {type === 'PERSISTENT' ? 'Messages are stored encrypted' : 'Messages auto-delete, no history'}
          </p>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button 
            className="bg-[#E1F0FF] hover:bg-[#BAD9F5] text-[#1A3A6B] font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50 min-w-[80px]"
            onClick={() => createGroup({ variables: { name, type } })}
            disabled={loading || name.trim().length === 0}
          >
            {loading ? '...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
