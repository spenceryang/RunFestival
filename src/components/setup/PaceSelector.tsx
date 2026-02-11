'use client';

import { formatPace } from '@/lib/gps/pace';

// Common paces in seconds per km
const PACE_OPTIONS = [
  { label: 'Easy', secondsPerKm: 390 }, // ~6:30
  { label: 'Moderate', secondsPerKm: 330 }, // ~5:30
  { label: 'Tempo', secondsPerKm: 300 }, // ~5:00
  { label: 'Fast', secondsPerKm: 270 }, // ~4:30
  { label: 'Sprint', secondsPerKm: 240 }, // ~4:00
  { label: 'No target', secondsPerKm: null },
];

interface PaceSelectorProps {
  selected: number | null;
  onChange: (secondsPerKm: number | null) => void;
  unit: 'km' | 'mi';
}

export function PaceSelector({ selected, onChange, unit }: PaceSelectorProps) {
  return (
    <div>
      <label className="stat-label block mb-3">Target Pace</label>
      <div className="grid grid-cols-3 gap-2">
        {PACE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.secondsPerKm)}
            className={`py-3 px-4 rounded-xl text-center transition-all
              ${
                selected === opt.secondsPerKm
                  ? 'bg-festival-orange text-white shadow-lg shadow-festival-orange/30'
                  : 'bg-festival-card border border-festival-border text-festival-text hover:border-festival-orange/50'
              }`}
          >
            <div className="font-semibold text-sm">{opt.label}</div>
            {opt.secondsPerKm && (
              <div className="text-xs mt-0.5 opacity-75">
                {formatPace(opt.secondsPerKm, unit)}/{unit}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
