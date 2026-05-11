'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EyeOff, Eye } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      window.dispatchEvent(new Event('nexchat:auth-changed'));
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-neutral-900 dark:text-neutral-100 text-sm placeholder-neutral-400 dark:placeholder-neutral-600 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
  const labelClass =
    'block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5';

  return (
    <form onSubmit={handleSubmit} id="register-form" noValidate>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
        Create Account
      </h2>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
            <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.5 3h1v5h-1V4zm.5 8a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputClass}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          autoComplete="email"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="username" className={labelClass}>
          Username
        </label>
        <input
          id="username"
          type="text"
          required
          placeholder="your_username"
          className={inputClass}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          autoComplete="username"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          required
          placeholder="Min. 8 characters"
          className={inputClass}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <div className="mb-6">
        <label htmlFor="confirm-password" className={labelClass}>
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type={showConfirmPassword ? 'text' : 'password'}
          required
          placeholder="Repeat password"
          className={inputClass}
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        id="register-button"
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          'Create Account'
        )}
      </button>

      <p className="text-center mt-5 text-xs text-neutral-500 dark:text-neutral-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-indigo-500 dark:text-indigo-400 font-medium hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
