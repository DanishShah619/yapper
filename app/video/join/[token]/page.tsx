"use client";

import { useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useParams, useRouter } from "next/navigation";

const RESOLVE_INVITE = gql`
  query ResolveVideoInvite($token: String!) {
    resolveVideoInvite(token: $token)
  }
`;

export default function VideoJoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const { data, error, loading } = useQuery<{ resolveVideoInvite: string }>(RESOLVE_INVITE, {
    variables: { token },
  });

  useEffect(() => {
    if (data?.resolveVideoInvite) {
      router.replace(`/video/${data.resolveVideoInvite}/waiting`);
    }
  }, [data?.resolveVideoInvite, router]);

  useEffect(() => {
    if (error?.message.includes("Not authenticated")) {
      router.replace(`/login?returnUrl=${encodeURIComponent(`/video/join/${token}`)}`);
    }
  }, [error?.message, router, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1ABC9C] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && !error.message.includes("Not authenticated")) {
    return (
      <div className="min-h-screen bg-[#F0F8FF] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#D6E8F5] p-8 text-center max-w-sm shadow-sm">
          <p className="text-base font-bold text-[#0A0A0A] mb-2">Link expired</p>
          <p className="text-sm font-medium text-[#6B7A99]">
            This invite link is invalid or has expired.
          </p>
          <button
            onClick={() => router.push("/video")}
            className="bg-[#1ABC9C] hover:bg-[#17a589] text-white font-semibold rounded-xl px-4 py-2 text-sm mt-4 w-full"
          >
            Back to Video
          </button>
        </div>
      </div>
    );
  }

  return null;
}
