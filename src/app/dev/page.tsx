'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Zap, Flame, Wind, BarChart3, BookOpen } from 'lucide-react';
import { validateDevPassword } from '@/lib/gps/sf-marathon-route';
import { useRunStore } from '@/lib/store/run-store';
import type { CoachingPersona } from '@/types/run';

const PERSONAS = [
  { id: 'hype', label: 'Hype Coach', icon: Flame, color: 'text-orange-400', description: 'High energy motivation' },
  { id: 'calm', label: 'Calm Guide', icon: Wind, color: 'text-blue-400', description: 'Mindful & steady' },
  { id: 'data', label: 'Data Nerd', icon: BarChart3, color: 'text-emerald-400', description: 'Stats & analysis' },
  { id: 'storyteller', label: 'Storyteller', icon: BookOpen, color: 'text-purple-400', description: 'Stories along the route' },
] as const;

export default function DevPage() {
  const router = useRouter();
  const startRun = useRunStore((s) => s.startRun);

  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<CoachingPersona>('hype');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (validateDevPassword(password)) {
        setAuthenticated(true);
        setError(false);
        // Store dev auth flag in sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('dev-auth', 'true');
        }
      } else {
        setError(true);
        setPassword('');
        // Remove shake after animation
        setTimeout(() => setError(false), 600);
      }
    },
    [password]
  );

  const handleEnterDevMode = useCallback(() => {
    // Start a marathon run (42.195km) with the selected persona
    startRun({
      targetDistanceMeters: 42195,
      targetPaceSecondsPerKm: 300,
      persona: selectedPersona,
    });
    router.push('/run?dev=true');
  }, [startRun, selectedPersona, router]);

  // Password gate
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-festival-darker flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-festival-card border border-festival-border flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-festival-orange" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Dev Mode</h1>
            <p className="text-sm text-festival-muted text-center">
              SF Marathon 2026 simulation
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className={`w-full px-4 py-3 rounded-xl bg-festival-card border
                           text-white placeholder-festival-muted
                           focus:outline-none focus:ring-2 focus:ring-festival-orange/50
                           transition-all ${
                             error
                               ? 'border-red-500 animate-[shake_0.3s_ease-in-out_2]'
                               : 'border-festival-border'
                           }`}
              />
              {error && (
                <p className="text-red-400 text-sm mt-2 text-center">
                  Wrong password
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              Enter Dev Mode
            </button>
          </form>

          <button
            onClick={() => router.push('/')}
            className="w-full mt-4 text-sm text-festival-muted hover:text-festival-text transition-colors text-center"
          >
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  // Persona picker + start
  return (
    <div className="min-h-screen bg-festival-darker flex flex-col px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Dev Mode</h1>
          <p className="text-xs text-festival-muted">SF Marathon 2026 · 42.2km</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="stat-label mb-3">Select Coaching Persona</h2>
        <div className="grid grid-cols-2 gap-3">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isSelected = selectedPersona === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => setSelectedPersona(persona.id as CoachingPersona)}
                className={`card flex flex-col items-center gap-2 py-4 transition-all ${
                  isSelected
                    ? 'border-festival-orange bg-festival-orange/5'
                    : 'hover:border-festival-border/80'
                }`}
              >
                <Icon className={`w-6 h-6 ${persona.color}`} />
                <span className="text-sm font-semibold text-white">
                  {persona.label}
                </span>
                <span className="text-xs text-festival-muted">
                  {persona.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-white mb-2">Route Info</h3>
        <ul className="space-y-1 text-sm text-festival-text">
          <li>📍 Start: Embarcadero & Market St</li>
          <li>🌉 Golden Gate Bridge out-and-back</li>
          <li>🌲 Through Golden Gate Park</li>
          <li>🏙️ Mission District & Mission Bay</li>
          <li>🏁 Finish: Embarcadero & Howard</li>
          <li className="text-festival-muted pt-1">Default speed: 20x (adjustable during run)</li>
        </ul>
      </div>

      <button
        onClick={handleEnterDevMode}
        className="btn-primary py-4 text-lg font-bold w-full"
      >
        Start SF Marathon Simulation
      </button>

      <button
        onClick={() => router.push('/')}
        className="mt-4 text-sm text-festival-muted hover:text-festival-text transition-colors text-center"
      >
        ← Back to home
      </button>
    </div>
  );
}
