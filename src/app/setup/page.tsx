'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Gauge, Headphones } from 'lucide-react';
import { DistanceSelector } from '@/components/setup/DistanceSelector';
import { PaceSelector } from '@/components/setup/PaceSelector';
import { PersonaSelector } from '@/components/setup/PersonaSelector';
import { useRunStore } from '@/lib/store/run-store';
import { useUserStore } from '@/lib/store/user-store';
import { createRunRecord } from '@/lib/services/run-persistence';
import { getGuestName, setGuestName } from '@/lib/guest-name';
import { unlockAudioContext } from '@/lib/audio/audio-unlock';
import type { CoachingPersona } from '@/types/run';

export default function SetupPage() {
  const router = useRouter();
  const startRun = useRunStore((s) => s.startRun);
  const setRunId = useRunStore((s) => s.setRunId);
  const setDistanceUnit = useRunStore((s) => s.setDistanceUnit);
  const distanceUnit = useRunStore((s) => s.distanceUnit);
  const user = useUserStore((s) => s.user);

  // Sync distance unit from user profile on mount
  useEffect(() => {
    if (user?.distanceUnit) {
      setDistanceUnit(user.distanceUnit);
    }
  }, [user?.distanceUnit, setDistanceUnit]);

  const [distance, setDistance] = useState<number | null>(5000);
  const [pace, setPace] = useState<number | null>(null);
  const [persona, setPersona] = useState<CoachingPersona>(
    user?.preferredPersona ?? 'hype'
  );
  const [guestName, setGuestNameLocal] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // Show guest name input for unauthenticated users who haven't set a name
  useEffect(() => {
    if (!user && !getGuestName()) {
      setShowGuestInput(true);
    }
  }, [user]);

  const handleGo = () => {
    // Save guest name if provided
    if (!user && guestName.trim()) {
      setGuestName(guestName.trim());
    }

    // CRITICAL: Unlock AudioContext during this user gesture (GO tap).
    // On iOS, AudioContext MUST be activated within the synchronous
    // call stack of a user gesture handler. Any `await` before this
    // exits the gesture context and iOS will keep AudioContext suspended.
    // Do NOT add any `await` before this line.
    unlockAudioContext();

    startRun({
      targetDistanceMeters: distance,
      targetPaceSecondsPerKm: pace,
      persona,
    });

    // Create run record in Supabase if authenticated — fire and forget.
    // MUST NOT await this: the network call would delay router.push()
    // and exit the iOS gesture context, preventing audio unlock.
    if (user) {
      createRunRecord({
        userId: user.id,
        targetDistanceMeters: distance,
        targetPaceSecondsPerKm: pace,
        persona,
      }).then((runId) => {
        if (runId) setRunId(runId);
      });
    }

    router.push('/run');
  };

  const firstName = user?.name?.split(' ')[0] ?? getGuestName() ?? 'Runner';

  return (
    <div className="min-h-screen bg-festival-darker px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full bg-festival-card border border-festival-border
                     flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-festival-text" />
        </button>
        <h1 className="text-2xl font-bold text-white">Your Run</h1>
      </div>
      <p className="text-festival-muted text-sm mb-8 ml-14">
        Ready when you are, {firstName}
      </p>

      {/* Settings with narrative context */}
      <div className="space-y-8">
        {/* Step 1: Distance */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-festival-orange" />
            <span className="text-xs text-festival-muted uppercase tracking-wider">How far today?</span>
          </div>
          <DistanceSelector selected={distance} onChange={setDistance} />
        </div>

        {/* Step 2: Pace */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-festival-orange" />
            <span className="text-xs text-festival-muted uppercase tracking-wider">What feels right?</span>
          </div>
          <PaceSelector selected={pace} onChange={setPace} unit={distanceUnit} />
        </div>

        {/* Step 3: Coach */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Headphones className="w-4 h-4 text-festival-orange" />
            <span className="text-xs text-festival-muted uppercase tracking-wider">Who&apos;s in your ear?</span>
          </div>
          <PersonaSelector selected={persona} onChange={setPersona} />
        </div>
      </div>

      {/* Guest name — for unauthenticated users */}
      {showGuestInput && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-festival-muted uppercase tracking-wider">What should we call you?</span>
          </div>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestNameLocal(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="w-full px-4 py-3 rounded-xl bg-festival-card border border-festival-border
                       text-white placeholder-festival-muted/50 text-sm
                       focus:outline-none focus:border-festival-orange transition-colors"
          />
        </div>
      )}

      {/* Start button */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleGo}
          className="w-40 h-40 rounded-full bg-gradient-to-br from-festival-orange to-festival-red
                     flex flex-col items-center justify-center text-white
                     shadow-2xl shadow-festival-orange/40
                     active:scale-95 transition-transform animate-glow"
        >
          <span className="text-4xl font-bold">GO</span>
          <span className="text-xs opacity-80 mt-1">Start Running</span>
        </button>
      </div>
    </div>
  );
}
