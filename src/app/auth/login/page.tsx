'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Zap, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { createClient, getSiteUrl } from '@/lib/supabase/client';
import { isStandalonePwa } from '@/lib/pwa-detect';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isPwa, setIsPwa] = useState(false);
  type LoginStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'error';
  const [status, setStatus] = useState<LoginStatus>(
    errorParam ? 'error' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState(
    errorParam === 'auth'
      ? 'Authentication failed. Please try again.'
      : errorParam === 'session'
        ? 'Your session has expired. Please sign in again.'
        : ''
  );

  // Detect PWA standalone mode on mount
  useEffect(() => {
    setIsPwa(isStandalonePwa());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMessage('');

    try {
      const supabase = createClient();

      if (isPwa) {
        // PWA mode: request OTP code instead of magic link.
        // Magic links open in Safari browser which has a separate cookie jar
        // from the PWA standalone context, so the session never reaches the PWA.
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
        } else {
          setStatus('sent');
        }
      } else {
        // Browser mode: use magic link redirect
        const siteUrl = getSiteUrl();
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        });

        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
        } else {
          setStatus('sent');
        }
      }
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) return;

    setStatus('verifying');
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });

      if (error) {
        setStatus('sent'); // go back to OTP entry
        setErrorMessage(error.message);
      } else {
        // Session established within PWA context — redirect
        router.push(redirect);
      }
    } catch {
      setStatus('sent');
      setErrorMessage('Verification failed. Please try again.');
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
        <h1 className="text-3xl font-bold text-white mb-2">Join the Run</h1>
        <p className="text-festival-muted text-center mb-8">
          Sign in or create an account with your email — no password needed
        </p>

        {(status === 'sent' || status === 'verifying') && isPwa ? (
          /* PWA mode: OTP code entry form */
          <div className="w-full max-w-sm">
            <div className="card p-6 mb-4">
              <KeyRound className="w-12 h-12 text-festival-orange mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2 text-center">
                Enter your code
              </h2>
              <p className="text-festival-muted text-sm text-center mb-4">
                We sent a 6-digit code to{' '}
                <span className="text-white font-medium">{email}</span>
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full px-4 py-4 rounded-xl bg-festival-card border border-festival-border
                             text-white text-center text-2xl font-mono tracking-[0.5em]
                             placeholder-festival-muted/30
                             focus:outline-none focus:border-festival-orange transition-colors"
                  autoFocus
                />

                {errorMessage && (
                  <p className="text-red-400 text-sm text-center">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'verifying' || otpCode.length < 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-festival-orange to-festival-red
                             text-white font-semibold
                             disabled:opacity-50 disabled:cursor-not-allowed
                             active:scale-[0.98] transition-transform"
                >
                  {status === 'verifying' ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            </div>
            <button
              onClick={() => { setStatus('idle'); setOtpCode(''); setErrorMessage(''); }}
              className="block mx-auto text-sm text-festival-muted hover:text-festival-orange transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : status === 'sent' ? (
          /* Browser mode: check email for magic link */
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
                Click the link in the email to sign in. New here? We&apos;ll set up your profile next.
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

            <p className="text-xs text-festival-muted text-center">
              Works for both new and existing accounts
            </p>
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
