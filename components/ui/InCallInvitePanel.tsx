"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Copy, Link, Send, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { encryptMessage, getGroupRoomKey } from "@/lib/e2ee";

type InCallInvitePanelProps = {
  videoRoomId: string;
  onClose: () => void;
};

type GroupNode = {
  id: string;
  name: string;
  avatarUrl: string | null;
  members: Array<{
    role: string;
    encryptedKey: string | null;
    user: {
      id: string;
      publicKey: string | null;
    };
  }>;
};

const GENERATE_INVITE = gql`
  mutation GenerateVideoInviteLink($videoRoomId: ID!, $ttl: Int) {
    generateVideoInviteLink(videoRoomId: $videoRoomId, ttl: $ttl)
  }
`;

const GET_GROUPS = gql`
  query GetMyGroupsForVideoInvite {
    groups {
      id
      name
      avatarUrl
      members { role encryptedKey user { id publicKey } }
    }
  }
`;

const ME_QUERY = gql`
  query VideoInviteMe {
    me { id publicKey }
  }
`;

const SUBMIT_GROUP_KEYS = gql`
  mutation SubmitVideoInviteGroupKeys($groupId: ID!, $wrappedKeys: [WrappedKeyInput!]!) {
    submitRotatedGroupKeys(groupId: $groupId, wrappedKeys: $wrappedKeys)
  }
`;

const SEND_INVITE_MESSAGE = gql`
  mutation SendVideoInviteMessage($groupId: ID!, $encryptedPayload: String!, $ephemeral: Boolean!) {
    sendMessage(groupId: $groupId, encryptedPayload: $encryptedPayload, ephemeral: $ephemeral) {
      id
    }
  }
`;

function normalizeVideoInviteUrl(inviteUrl: string): string {
  if (typeof window === "undefined") return inviteUrl;

  try {
    const url = new URL(inviteUrl, window.location.origin);
    if (url.pathname.startsWith("/video/join/")) {
      url.protocol = window.location.protocol;
      url.host = window.location.host;
    }
    return url.toString();
  } catch {
    return inviteUrl;
  }
}

export function InCallInvitePanel({ videoRoomId, onClose }: InCallInvitePanelProps) {
  const { showToast } = useToast();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { data: groupsData, loading: groupsLoading } = useQuery<{ groups: GroupNode[] }>(GET_GROUPS);
  const { data: meData } = useQuery<{ me: { id: string; publicKey: string | null } }>(ME_QUERY);
  const [generateInvite, { loading: generating }] = useMutation<{ generateVideoInviteLink: string }>(GENERATE_INVITE);
  const [sendMessage, { loading: sending }] = useMutation(SEND_INVITE_MESSAGE);
  const [submitGroupKeys] = useMutation(SUBMIT_GROUP_KEYS);

  const handleGenerate = async () => {
    try {
      const { data } = await generateInvite({
        variables: { videoRoomId, ttl: 3600 },
      });
      if (data?.generateVideoInviteLink) {
        setGeneratedLink(normalizeVideoInviteUrl(data.generateVideoInviteLink));
      }
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Could not generate invite link", "error");
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      showToast("Link copied!", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const handleSendToGroup = async (group: GroupNode) => {
    if (!generatedLink || !meData?.me) return;

    try {
      const { roomKey, wrappedKeys } = await getGroupRoomKey(
        group.id,
        group.members,
        meData.me.id,
        meData.me.publicKey,
        { allowInitialize: true }
      );

      if (wrappedKeys.length > 0) {
        await submitGroupKeys({ variables: { groupId: group.id, wrappedKeys } });
      }

      const encryptedPayload = await encryptMessage(`Join my video call: ${generatedLink}`, roomKey);

      await sendMessage({
        variables: {
          groupId: group.id,
          encryptedPayload,
          ephemeral: false,
        },
      });

      setSentTo(group.name);
      showToast(`Invite sent to ${group.name}`, "success");
      window.setTimeout(() => setSentTo(null), 3000);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Could not send invite", "error");
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 bg-white rounded-2xl border border-[#D6E8F5] shadow-xl w-72 overflow-hidden">
      <div className="px-4 py-3 border-b border-[#D6E8F5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link size={16} className="text-[#1ABC9C]" />
          <p className="text-sm font-bold text-[#0A0A0A]">Send invite link</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[#6B7A99] hover:bg-[#E1F0FF] hover:text-[#0A0A0A]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {!generatedLink && (
          <>
            <p className="text-xs font-medium text-[#6B7A99]">
              Generate a join link for this call
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[#1ABC9C] hover:bg-[#17a589] disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2 text-sm w-full"
            >
              {generating ? "Generating..." : "Generate Link"}
            </button>
          </>
        )}

        {generatedLink && (
          <>
            <div className="bg-[#F0F8FF] border border-[#D6E8F5] rounded-xl px-3 py-2 text-xs font-medium text-[#6B7A99] truncate">
              {generatedLink}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="bg-white border border-[#D6E8F5] hover:bg-[#F0F8FF] text-[#1A3A6B] font-semibold rounded-xl px-4 py-2 text-sm w-full flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              Copy link
            </button>

            <div className="flex items-center gap-2">
              <div className="h-px bg-[#D6E8F5] flex-1" />
              <span className="text-[11px] font-semibold text-[#6B7A99]">or send to a group</span>
              <div className="h-px bg-[#D6E8F5] flex-1" />
            </div>

            {sentTo && (
              <div className="bg-[#D0F5EE] border border-[#1ABC9C] rounded-xl px-3 py-2 text-xs font-semibold text-[#0A7A65]">
                Invite sent to {sentTo}
              </div>
            )}

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {groupsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-10 rounded-xl bg-[#F0F8FF] animate-pulse" />
                ))
              ) : (
                (groupsData?.groups ?? []).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSendToGroup(group)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#E1F0FF] cursor-pointer disabled:opacity-60 text-left"
                  >
                    <Avatar src={group.avatarUrl} name={group.name} size="sm" />
                    <span className="text-sm font-bold text-[#0A0A0A] flex-1 truncate">
                      {group.name}
                    </span>
                    <Send size={16} className="text-[#6B7A99]" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
