'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import {gql} from '@apollo/client'
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Clock, Wifi } from 'lucide-react';

// ── GraphQL Operations ────────────────────────────────────────────────────────

const GET_KEY_HEALTH = gql`
  query GetKeyHealth($roomId: ID!) {
    roomKeyHealth(roomId: $roomId) {
      totalMembers pending delivered acknowledged decrypted
      healthScore isHealthy staleMembers
    }
    memberKeyDeliveryDetails(roomId: $roomId) {
      userId username status retryCount isStale minutesSinceCreation
      deliveredAt acknowledgedAt decryptedAt
    }
  }
`;

const REDELIVER_KEY = gql`
  mutation RedeliverKey($roomId: ID!, $userId: ID!) {
    redeliverKey(roomId: $roomId, userId: $userId) {
      success
      reason
    }
  }
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    label: 'Pending',
    description: 'Shard uploaded — member has not fetched it yet',
  },
  DELIVERED: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-400',
    label: 'Delivered',
    description: 'Member fetched the shard — awaiting acknowledgement',
  },
  ACKNOWLEDGED: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    dot: 'bg-teal-400',
    label: 'Acknowledged',
    description: 'Client confirmed receipt — decryption in progress',
  },
  DECRYPTED: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Decrypted',
    description: 'Member has a working room key — fully ready',
  },
} as const;

type DeliveryStatus = keyof typeof STATUS_CONFIG;

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberDetail {
  userId: string;
  username: string;
  status: DeliveryStatus;
  retryCount: number;
  isStale: boolean;
  minutesSinceCreation: number;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  decryptedAt: string | null;
}

interface HealthSummary {
  totalMembers: number;
  pending: number;
  delivered: number;
  acknowledged: number;
  decrypted: number;
  healthScore: number;
  isHealthy: boolean;
  staleMembers: string[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthScoreBadge({ score, isHealthy }: { score: number; isHealthy: boolean }) {
  const color =
    isHealthy
      ? 'from-emerald-500 to-teal-500'
      : score >= 66
      ? 'from-teal-500 to-blue-500'
      : score >= 33
      ? 'from-amber-500 to-orange-500'
      : 'from-red-500 to-rose-500';

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          strokeWidth="6"
          strokeDasharray={`${(score / 100) * 175.9} 175.9`}
          strokeLinecap="round"
          className={`stroke-current ${score >= 66 ? 'text-emerald-500' : score >= 33 ? 'text-amber-500' : 'text-red-500'}`}
        />
      </svg>
      <span className="relative text-sm font-bold text-slate-800">{score}%</span>
    </div>
  );
}

function StatusPill({ status }: { status: DeliveryStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface KeyHealthDashboardProps {
  roomId: string;
}

export function KeyHealthDashboard({ roomId }: KeyHealthDashboardProps) {
  const [redelivering, setRedelivering] = useState<string | null>(null);
  const [redeliveryMessage, setRedeliveryMessage] = useState<{ userId: string; text: string; ok: boolean } | null>(null);

  const { data, loading, refetch } = useQuery(GET_KEY_HEALTH, {
    variables: { roomId },
    fetchPolicy: 'cache-and-network',
    pollInterval: 15000, // auto-refresh every 15s as fallback to Socket.IO
  });

  const [redeliverKey] = useMutation(REDELIVER_KEY);

  const handleRedeliver = async (userId: string, username: string) => {
    setRedelivering(userId);
    setRedeliveryMessage(null);
    try {
      const { data: result } = await redeliverKey({ variables: { roomId, userId } });
      const { success, reason } = result.redeliverKey;
      setRedeliveryMessage({
        userId,
        text: success ? `Re-delivery triggered for @${username}` : reason ?? 'Unknown error',
        ok: success,
      });
      if (success) refetch();
    } catch (err: any) {
      setRedeliveryMessage({ userId, text: err.message, ok: false });
    } finally {
      setRedelivering(null);
      setTimeout(() => setRedeliveryMessage(null), 4000);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse space-y-4">
        <div className="h-5 bg-slate-100 rounded w-1/3" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const health: HealthSummary | undefined = data?.roomKeyHealth;
  const members: MemberDetail[] = data?.memberKeyDeliveryDetails ?? [];
  const MAX_RETRIES = 3;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Key Delivery Health</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time tracking of room key delivery</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {health && <HealthScoreBadge score={health.healthScore} isHealthy={health.isHealthy} />}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Status Summary Bar ── */}
      {health && (
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
          {(
            [
              { label: 'Pending', value: health.pending, key: 'PENDING' },
              { label: 'Delivered', value: health.delivered, key: 'DELIVERED' },
              { label: 'Acknowledged', value: health.acknowledged, key: 'ACKNOWLEDGED' },
              { label: 'Decrypted', value: health.decrypted, key: 'DECRYPTED' },
            ] as const
          ).map(({ label, value, key }) => {
            const cfg = STATUS_CONFIG[key];
            return (
              <div key={key} className="px-4 py-3 text-center">
                <div className={`text-xl font-bold ${cfg.text}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Stale Alert Banner ── */}
      <AnimatePresence>
        {health && health.staleMembers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 my-3 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                {health.staleMembers.length} member{health.staleMembers.length !== 1 ? 's' : ''} ha{health.staleMembers.length !== 1 ? 've' : 's'} not received their key within the expected time.
                Use <strong>Re-deliver</strong> to retry, or rotate the room key if re-delivery fails repeatedly.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Re-delivery Feedback ── */}
      <AnimatePresence>
        {redeliveryMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 my-2"
          >
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border ${
              redeliveryMessage.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {redeliveryMessage.ok
                ? <CheckCircle2 size={13} />
                : <AlertTriangle size={13} />}
              {redeliveryMessage.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Per-Member Table ── */}
      <div className="divide-y divide-slate-50">
        {members.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            No members to display.
          </div>
        )}
        {members.map((member) => {
          const cfg = STATUS_CONFIG[member.status];
          const isMaxRetries = member.retryCount >= MAX_RETRIES;
          const isRedelivering = redelivering === member.userId;

          return (
            <motion.div
              key={member.userId}
              layout
              className={`px-6 py-3.5 flex items-center justify-between ${
                member.isStale ? 'bg-amber-50/40' : 'bg-white'
              } hover:bg-slate-50/60 transition-colors`}
            >
              {/* Member info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      @{member.username}
                    </span>
                    <StatusPill status={member.status} />
                    {member.isStale && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        Stale · {member.minutesSinceCreation}m
                      </span>
                    )}
                    {member.retryCount > 0 && (
                      <span className="text-xs text-slate-400">
                        {member.retryCount}/{MAX_RETRIES} retries
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {cfg.description}
                  </p>
                </div>
              </div>

              {/* Action */}
              {member.status !== 'DECRYPTED' && (
                <div className="flex-shrink-0 ml-4">
                  {isMaxRetries ? (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600">
                      Rotate Key Required
                    </span>
                  ) : (
                    <button
                      id={`redeliver-${member.userId}`}
                      onClick={() => handleRedeliver(member.userId, member.username)}
                      disabled={isRedelivering}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isRedelivering
                        ? <><RefreshCw size={11} className="animate-spin" /> Sending…</>
                        : <><Wifi size={11} /> Re-deliver</>
                      }
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Healthy Footer ── */}
      {health?.isHealthy && health.totalMembers > 0 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">
            All {health.totalMembers} member{health.totalMembers !== 1 ? 's' : ''} have successfully decrypted the room key.
          </span>
        </div>
      )}
    </div>
  );
}
