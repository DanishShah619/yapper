'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const jwt = localStorage.getItem('nexchat_token');
      if (!jwt) {
        // Not logged in -> redirect to login with a breadcrumb to return here
        router.push(`/login?returnUrl=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }

      try {
        const res = await fetch(`/api/invite/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to process invite link');
          return;
        }

        if (data.url) {
          // Successfully joined, redirect to the chat or group page
          router.replace(data.url);
        }
      } catch (err: any) {
        setError(err.message || 'Network error processing invite');
      }
    };

    run();
  }, [token, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center text-center max-w-sm"
        >
          <ShieldAlert size={40} className="text-red-400 mb-3" />
          <h2 className="text-base font-bold text-red-400 mb-1">Invite Failed</h2>
          <p className="text-sm text-red-300/70 mb-5">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-all"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Loader2 size={32} className="animate-spin text-indigo-400 mb-4" />
      <p className="text-sm text-slate-400">Verifying invite link...</p>
    </div>
  );
}
