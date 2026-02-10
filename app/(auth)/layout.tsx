'use client';

import { BackgroundPaths } from '@/components/ui/background-paths';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* Full-screen container — background sits behind, content scrolls on top */
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 overflow-hidden bg-white dark:bg-neutral-950">

      {/* Animated SVG paths — purely decorative, behind everything */}
      <BackgroundPaths />

      {/* All visible content sits above the paths via z-10 */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[420px] gap-6">

        {/* Brand — sits ABOVE the card */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path
                d="M12 20C12 15.5817 15.5817 12 20 12C24.4183 12 28 15.5817 28 20C28 24.4183 24.4183 28 20 28"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M16 20C16 17.7909 17.7909 16 20 16C22.2091 16 24 17.7909 24 20"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="20" cy="20" r="2" fill="white" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            NexChat
          </h1>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 tracking-widest uppercase">
            Secure Social Messaging
          </p>
        </div>

        {/* Auth card — below the brand */}
        <div className="w-full rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl shadow-2xl p-8">
          {children}
        </div>

      </div>
    </div>
  );
}
