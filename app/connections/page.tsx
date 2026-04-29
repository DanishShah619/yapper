"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import Link from 'next/link';
import { Users, UserCheck, MoreVertical, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeletons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { usePresence } from '@/lib/hooks/usePresence';

const GET_CONNECTIONS = gql`
  query GetConnections {
    connections { id username avatarUrl }
  }
`;

const GET_CONNECTION_REQUESTS = gql`
  query GetConnectionRequests {
    connectionRequests { id requester { id username avatarUrl } }
  }
`;

const RESPOND_TO_CONNECTION_REQUEST = gql`
  mutation RespondToConnectionRequest($requestId: ID!, $accept: Boolean!) {
    respondToConnectionRequest(requestId: $requestId, accept: $accept) { id }
  }
`;

const REMOVE_CONNECTION = gql`
  mutation RemoveConnection($userId: ID!) {
    removeConnection(userId: $userId)
  }
`;

type TabType = 'connections' | 'requests';

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('connections');
  const { showToast } = useToast();

  const { data: connData, loading: connLoading, error: connError, refetch: refetchConn } = useQuery<{ connections: any[] }>(GET_CONNECTIONS);
  const { data: reqData, loading: reqLoading, error: reqError, refetch: refetchReq } = useQuery<{ connectionRequests: any[] }>(GET_CONNECTION_REQUESTS);

  const [respondRequest] = useMutation(RESPOND_TO_CONNECTION_REQUEST, {
    onCompleted: () => {
      refetchReq();
      refetchConn();
    },
    onError: (err) => showToast(err.message, 'error')
  });

  const [removeConnection] = useMutation(REMOVE_CONNECTION, {
    onCompleted: () => {
      refetchConn();
      showToast("Connection removed", "success");
    },
    onError: (err) => showToast(err.message, 'error')
  });

  const connections = connData?.connections || [];
  const requests = reqData?.connectionRequests || [];

  const presenceMap = usePresence(connections.map((c: any) => c.id));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{ id: string; username: string } | null>(null);

  const handleRespond = async (requestId: string, accept: boolean) => {
    await respondRequest({ variables: { requestId, accept } });
    showToast(accept ? "Request accepted" : "Request declined", "success");
  };

  const handleRemoveClick = (user: any) => {
    setUserToRemove({ id: user.id, username: user.username });
    setConfirmOpen(true);
  };

  const executeRemove = async () => {
    if (userToRemove) {
      await removeConnection({ variables: { userId: userToRemove.id } });
      setConfirmOpen(false);
      setUserToRemove(null);
    }
  };

  const isLoading = connLoading || reqLoading;
  const isError = connError || reqError;

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
          title="Connections" 
          subtitle={`${connections.length} connections`} 
          action={<Link href="/search" className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150">+ Find People</Link>}
        />

        <div className="flex gap-4 mb-6 border-b border-[#D6E8F5]">
          <button
            className={`pb-2 text-sm ${activeTab === 'connections' ? 'border-b-2 border-[#1ABC9C] text-[#0A0A0A] font-bold' : 'text-[#6B7A99] font-medium hover:text-[#0A0A0A]'}`}
            onClick={() => setActiveTab('connections')}
          >
            My Connections
          </button>
          <button
            className={`pb-2 text-sm ${activeTab === 'requests' ? 'border-b-2 border-[#1ABC9C] text-[#0A0A0A] font-bold' : 'text-[#6B7A99] font-medium hover:text-[#0A0A0A]'}`}
            onClick={() => setActiveTab('requests')}
          >
            Pending Requests ({requests.length})
          </button>
        </div>

        {activeTab === 'connections' && (
          <div>
            {connLoading ? (
              <SkeletonList />
            ) : connections.length === 0 ? (
              <EmptyState 
                icon={Users} 
                title="No connections yet" 
                description="Search for people to connect with" 
                action={<Link href="/search" className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150">Find People</Link>} 
              />
            ) : (
              <div className="space-y-3">
                {connections.map((c: any) => {
                  const isOnline = presenceMap.get(c.id) ?? false;
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-[#D6E8F5] p-4 shadow-sm shadow-blue-100/50 flex items-center gap-3">
                      <Avatar src={c.avatarUrl} name={c.username} size="md" online={isOnline} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#0A0A0A]">{c.username}</p>
                        <span className="bg-[#D0F5EE] text-[#0A7A65] text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1">Connected</span>
                      </div>
                      <div className="relative group/menu">
                        <button title="verticle"className="hover:bg-[#E1F0FF] text-[#6B7A99] hover:text-[#0A0A0A] rounded-lg p-2 text-sm transition-colors duration-150">
                          <MoreVertical size={18} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[#D6E8F5] rounded-xl shadow-xl w-32 hidden group-hover/menu:block z-10">
                          <button 
                            className="w-full text-left px-4 py-2 text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-colors duration-150"
                            onClick={() => handleRemoveClick(c)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            {reqLoading ? (
              <SkeletonList />
            ) : requests.length === 0 ? (
              <EmptyState 
                icon={UserCheck} 
                title="No pending requests" 
                description="Connection requests you receive will appear here" 
              />
            ) : (
              <div className="space-y-3">
                {requests.map((r: any) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#D6E8F5] p-4 shadow-sm shadow-blue-100/50 flex items-center gap-3">
                    <Avatar src={r.requester.avatarUrl} name={r.requester.username} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#0A0A0A]">{r.requester.username}</p>
                      <span className="bg-[#FFF3CD] text-[#7A5900] text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1">Wants to connect</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRespond(r.id, true)}
                        className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors duration-150"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleRespond(r.id, false)}
                        className="bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors duration-150"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog 
        open={confirmOpen}
        title="Remove Connection"
        description={`Are you sure you want to remove ${userToRemove?.username} from your connections?`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={executeRemove}
        onCancel={() => {
          setConfirmOpen(false);
          setUserToRemove(null);
        }}
      />
    </div>
  );
}
