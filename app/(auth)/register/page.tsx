'use client';

import { useState, FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RegisterData {
  register: {
    token: string;
    user: { id: string; email: string; username: string };
  };
}

const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $username: String!, $password: String!) {
    register(email: $email, username: $username, password: $password) {
      token
      user {
        id
        email
        username
      }
    }
  }
`;

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const [register, { loading }] = useMutation<RegisterData>(REGISTER_MUTATION, {
    onCompleted: (data: RegisterData) => {
      localStorage.setItem('nexchat_token', data.register.token);
      router.push('/');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    await register({
      variables: {
        email: formData.email,
        username: formData.username,
        password: formData.password,
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form" id="register-form">
        <h2 className="auth-form-title">Create Account</h2>

        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.5 3h1v5h-1V4zm.5 8a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
            {error}
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            className="auth-input"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="username" className="auth-label">Username</label>
          <input
            id="username"
            type="text"
            required
            placeholder="your_username"
            className="auth-input"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <input
            id="password"
            type="password"
            required
            placeholder="Min. 8 characters"
            className="auth-input"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm-password" className="auth-label">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            placeholder="Repeat password"
            className="auth-input"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit"
          id="register-button"
        >
          {loading ? (
            <span className="auth-spinner" />
          ) : (
            'Create Account'
          )}
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </form>

      <style jsx>{`
        .auth-form {
          background: rgba(17, 17, 27, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .auth-form-title {
          font-size: 20px;
          font-weight: 600;
          color: #f0f0f5;
          margin: 0 0 24px 0;
        }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .auth-field {
          margin-bottom: 18px;
        }

        .auth-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 6px;
        }

        .auth-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #f0f0f5;
          font-size: 14px;
          transition: all 0.2s ease;
          outline: none;
          box-sizing: border-box;
        }

        .auth-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          background: rgba(255, 255, 255, 0.06);
        }

        .auth-input::placeholder {
          color: #4b5563;
        }

        .auth-submit {
          width: 100%;
          padding: 12px;
          margin-top: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
        }

        .auth-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
        }

        .auth-submit:active {
          transform: translateY(0);
        }

        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .auth-switch {
          text-align: center;
          margin: 20px 0 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .auth-switch :global(.auth-link) {
          color: #818cf8;
          text-decoration: none;
          font-weight: 500;
        }

        .auth-switch :global(.auth-link:hover) {
          color: #a5b4fc;
          text-decoration: underline;
        }
      `}</style>
    </>
  );
}
