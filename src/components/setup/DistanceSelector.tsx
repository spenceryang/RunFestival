'use client';

const DISTANCE_OPTIONS = [
  { label: '1K', meters: 1000 },
  { label: '3K', meters: 3000 },
  { label: '5K', meters: 5000 },
  { label: '10K', meters: 10000 },
  { label: 'Half', meters: 21097 },
  { label: 'Free', meters: null },
];

interface DistanceSelectorProps {
  selected: number | null;
  onChange: (meters: number | null) => void;
}

export function DistanceSelector({ selected, onChange }: DistanceSelectorProps) {
  return (
    <div>
      <label className="stat-label block mb-3">Distance</label>
      <div className="grid grid-cols-3 gap-2">
        {DISTANCE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.meters)}
            className={`py-3 px-4 rounded-xl text-center font-semibold transition-all
              ${
                selected === opt.meters
                  ? 'bg-festival-orange text-white shadow-lg shadow-festival-orange/30'
                  : 'bg-festival-card border border-festival-border text-festival-text hover:border-festival-orange/50'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
