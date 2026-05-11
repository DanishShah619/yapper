'use client';

import { useEffect } from 'react';
import { useQuery, useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { disconnectSocket } from '@/lib/socketClient';
import { Component as EtherealShadow } from '@/components/ui/etheral-shadow';
import { GlowingCard } from '@/components/ui/glowing-card';
import { MessageSquare, Users, Home, Video } from 'lucide-react';

const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      username
      avatarUrl
      createdAt
    }
  }
`;

interface MeData {
  me: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    createdAt: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const client = useApolloClient();

  const { data, loading, error } = useQuery<MeData>(ME_QUERY);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      disconnectSocket();
      client.clearStore();
      router.push('/login');
    }
  };

  useEffect(() => {
    if (error) {
      router.push('/login');
    }
  }, [error, router]);

  if (loading || (!data && !error)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return null;
  }

  const user = data?.me;

  return (
    <div className="dashboard">
      {/* ── Ethereal shadow background — fixed, behind everything ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <EtherealShadow
          color="rgba(99, 102, 241, 0.35)"
          animation={{ scale: 80, speed: 60 }}
          noise={{ opacity: 0.6, scale: 1.2 }}
          sizing="fill"
          style={{ width: '100%', height: '100%', background: '#0a0a0f' }}
        />
      </div>

      {/* ── All dashboard content sits above the background ── */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', color: '#f0f0f5' }}>
        <nav className="dashboard-nav">
          <div className="dashboard-nav-brand">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#nav-gradient)" />
              <path d="M12 20C12 15.5817 15.5817 12 20 12C24.4183 12 28 15.5817 28 20C28 24.4183 24.4183 28 20 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M16 20C16 17.7909 17.7909 16 20 16C22.2091 16 24 17.7909 24 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="20" r="2" fill="white" />
              <defs>
                <linearGradient id="nav-gradient" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="dashboard-nav-title">NexChat</span>
          </div>

          <div className="dashboard-nav-user">
            <div className="dashboard-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <span className="dashboard-username">@{user?.username}</span>
            <button
              onClick={handleLogout}
              className="dashboard-logout"
              id="logout-button"
            >
              Sign Out
            </button>
          </div>
        </nav>

        <main className="dashboard-main">
          <div className="dashboard-welcome">
            <h1 className="dashboard-welcome-title">
              Welcome, <span className="dashboard-highlight">{user?.username}</span>
            </h1>
            <p className="dashboard-welcome-text">
              Your secure messaging platform is ready. Get yapping...
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <GlowingCard 
                href="/chat"
                title="Messages"
                badge="LIVE"
                dotColor="#818cf8"
                icon={<MessageSquare size={22} />}
                description="E2E encrypted DMs so no snoopin' around"
              />
              <GlowingCard 
                href="/connections"
                title="Connections"
                badge="LIVE"
                dotColor="#60a5fa"
                icon={<Users size={22} />}
                description="Find friends, send and accept connection requests. Click to open."
              />
              <GlowingCard 
                href="/groups"
                title="Groups"
                badge="LIVE"
                dotColor="#34d399"
                icon={<Home size={22} />}
                description="Group Chatting ? We got you fam."
              />
              <GlowingCard 
                href="/video"
                title="Video Calls"
                badge="LIVE"
                dotColor="#c084fc"
                icon={<Video size={22} />}
                description="Secure Video calling for upto 4 coz too many coooks spoil the broth"
              />
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .dashboard-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(10, 10, 15, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .dashboard-nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dashboard-nav-title {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .dashboard-nav-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dashboard-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .dashboard-username {
          font-size: 14px;
          color: #9ca3af;
        }

        .dashboard-logout {
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #9ca3af;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dashboard-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .dashboard-main {
          max-width: 960px;
          margin: 0 auto;
          padding: 48px 24px;
        }

        .dashboard-welcome-title {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .dashboard-highlight {
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dashboard-welcome-text {
          font-size: 15px;
          color: #6b7280;
          margin: 0 0 40px 0;
        }

        .dashboard-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }

        .dashboard-card {
          background: rgba(17, 17, 27, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 24px;
          transition: all 0.2s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .dashboard-card:hover {
          border-color: rgba(99, 102, 241, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        }

        .dashboard-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-bottom: 14px;
        }

        .dashboard-card h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 6px 0;
        }

        .dashboard-card p {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
