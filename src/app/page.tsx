'use client';

import { useRouter } from 'next/navigation';
import { Play, Users, Zap, Monitor } from 'lucide-react';
import { useCollectiveStore } from '@/lib/store/collective-store';
import { useRunStore } from '@/lib/store/run-store';

export default function HomePage() {
  const router = useRouter();
  const runnerCount = useCollectiveStore((s) => s.runnerCount);
  const startRun = useRunStore((s) => s.startRun);

  const handleDemo = () => {
    startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: 300,
      persona: 'hype',
    });
    router.push('/run?demo=true');
  };

  return (
    <div className="min-h-screen bg-festival-darker flex flex-col">
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

        {/* Demo mode */}
        <button
          onClick={handleDemo}
          className="mt-6 flex items-center gap-2 text-sm text-festival-muted
                     hover:text-festival-orange transition-colors"
        >
          <Monitor className="w-4 h-4" />
          Demo Mode (simulated run at 10x)
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-festival-muted">
          AI-powered coaching with real-time community presence
        </p>
      </div>
    </div>
  );
}
