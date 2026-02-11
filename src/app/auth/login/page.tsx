'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Zap, Mail, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    errorParam ? 'error' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState(
    errorParam === 'auth' ? 'Authentication failed. Please try again.' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
      } else {
        setStatus('sent');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-festival-darker flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full bg-festival-card border border-festival-border
                     flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-festival-text" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Zap className="w-10 h-10 text-festival-orange mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-festival-muted text-center mb-8">
          Sign in to save your runs and get personalized coaching
        </p>

        {status === 'sent' ? (
          <div className="w-full max-w-sm text-center">
            <div className="card p-6">
              <Mail className="w-12 h-12 text-festival-orange mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Check your email
              </h2>
              <p className="text-festival-muted text-sm">
                We sent a magic link to{' '}
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-festival-muted text-sm mt-2">
                Click the link in the email to sign in.
              </p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="mt-4 text-sm text-festival-muted hover:text-festival-orange transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm text-festival-text mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-festival-card border border-festival-border
                           text-white placeholder-festival-muted/50
                           focus:outline-none focus:border-festival-orange transition-colors"
                autoFocus
              />
            </div>

            {status === 'error' && errorMessage && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-festival-orange to-festival-red
                         text-white font-semibold
                         disabled:opacity-50 disabled:cursor-not-allowed
                         active:scale-[0.98] transition-transform"
            >
              {status === 'sending' ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <div className="mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-festival-muted hover:text-festival-orange transition-colors"
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-festival-darker" />}>
      <LoginForm />
    </Suspense>
  );
}
