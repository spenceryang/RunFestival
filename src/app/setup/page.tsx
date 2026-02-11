'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DistanceSelector } from '@/components/setup/DistanceSelector';
import { PaceSelector } from '@/components/setup/PaceSelector';
import { PersonaSelector } from '@/components/setup/PersonaSelector';
import { useRunStore } from '@/lib/store/run-store';
import { useUserStore } from '@/lib/store/user-store';
import { createRunRecord } from '@/lib/services/run-persistence';
import type { CoachingPersona } from '@/types/run';

export default function SetupPage() {
  const router = useRouter();
  const startRun = useRunStore((s) => s.startRun);
  const setRunId = useRunStore((s) => s.setRunId);
  const distanceUnit = useRunStore((s) => s.distanceUnit);
  const user = useUserStore((s) => s.user);

  const [distance, setDistance] = useState<number | null>(5000);
  const [pace, setPace] = useState<number | null>(null);
  const [persona, setPersona] = useState<CoachingPersona>(
    user?.preferredPersona ?? 'hype'
  );

  const handleGo = async () => {
    startRun({
      targetDistanceMeters: distance,
      targetPaceSecondsPerKm: pace,
      persona,
    });

    // Create run record in Supabase if authenticated
    if (user) {
      const runId = await createRunRecord({
        userId: user.id,
        targetDistanceMeters: distance,
        targetPaceSecondsPerKm: pace,
        persona,
      });
      if (runId) {
        setRunId(runId);
      }
    }

    router.push('/run');
  };

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full bg-festival-card border border-festival-border
                     flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-festival-text" />
        </button>
        <h1 className="text-2xl font-bold text-white">Set Up Your Run</h1>
      </div>

      {/* Settings */}
      <div className="space-y-8">
        <DistanceSelector selected={distance} onChange={setDistance} />
        <PaceSelector selected={pace} onChange={setPace} unit={distanceUnit} />
        <PersonaSelector selected={persona} onChange={setPersona} />
      </div>

      {/* GO button */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleGo}
          className="w-40 h-40 rounded-full bg-gradient-to-br from-festival-orange to-festival-red
                     flex items-center justify-center text-white text-4xl font-bold
                     shadow-2xl shadow-festival-orange/40
                     active:scale-95 transition-transform animate-glow"
        >
          GO
        </button>
      </div>
    </div>
  );
}
