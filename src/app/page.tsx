'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Users, Zap, Monitor, User, LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { useRunStore } from '@/lib/store/run-store';
import { useUserStore } from '@/lib/store/user-store';

export default function HomePage() {
  const router = useRouter();
  const runnerCount = useCollectiveStore((s) => s.runnerCount);
  const startRun = useRunStore((s) => s.startRun);
  const user = useUserStore((s) => s.user);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const signOut = useUserStore((s) => s.signOut);

  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleDemo = () => {
    startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: 300,
      persona: 'hype',
    });
    router.push('/run?demo=true');
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-festival-darker flex flex-col">
      {/* Auth bar */}
      <div className="flex items-center justify-end px-6 pt-4">
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 text-sm text-festival-text
                         hover:text-festival-orange transition-colors"
            >
              <User className="w-4 h-4" />
              {user.name}
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-44 z-20
                                bg-festival-card border border-festival-border rounded-xl
                                shadow-xl overflow-hidden">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/profile');
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-festival-text
                               hover:bg-festival-border/50 transition-colors
                               flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Edit Profile
                  </button>
                  <div className="border-t border-festival-border" />
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-red-400
                               hover:bg-festival-border/50 transition-colors
                               flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push('/auth/login')}
            className="flex items-center gap-2 text-sm text-festival-muted
                       hover:text-festival-orange transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Log In
          </button>
        )}
      </div>

      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo / Brand */}
        <div className="mb-2">
          <Zap className="w-12 h-12 text-festival-orange mx-auto" />
        </div>
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          RunFestival
        </h1>
        <p className="text-festival-muted text-center text-lg mb-12">
          You run alone. You never run alone.
        </p>

        {/* Start button */}
        <button
          onClick={() => router.push('/setup')}
          className="w-44 h-44 rounded-full bg-gradient-to-br from-festival-orange to-festival-red
                     flex flex-col items-center justify-center text-white
                     shadow-2xl shadow-festival-orange/40
                     active:scale-95 transition-transform animate-glow"
        >
          <Play className="w-14 h-14 mb-1" />
          <span className="text-lg font-bold">START RUN</span>
        </button>

        {/* Live runner count */}
        {runnerCount > 0 && (
          <div className="mt-8 flex items-center gap-2 text-festival-muted">
            <Users className="w-4 h-4 text-festival-orange" />
            <span>
              <span className="text-white font-semibold">
                {runnerCount.toLocaleString()}
              </span>{' '}
              people running right now
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}

        {/* Secondary actions */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push('/community')}
            className="flex items-center gap-2 text-sm text-festival-text
                       hover:text-festival-orange transition-colors"
          >
            <Users className="w-4 h-4" />
            Community Timeline
          </button>

          <button
            onClick={handleDemo}
            className="flex items-center gap-2 text-sm text-festival-muted
                       hover:text-festival-orange transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Demo Mode (simulated run at 10x)
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center space-y-2">
        <p className="text-xs text-festival-muted">
          AI-powered coaching with real-time community presence
        </p>
        <button
          onClick={() => router.push('/dev')}
          className="text-[10px] text-festival-muted/40 hover:text-festival-muted transition-colors"
        >
          Dev Mode
        </button>
      </div>
    </div>
  );
}
