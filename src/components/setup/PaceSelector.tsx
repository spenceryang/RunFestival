'use client';

import { useState, useCallback, useRef } from 'react';
import { formatPace } from '@/lib/gps/pace';

// Pace spectrum from competitive to relaxed (seconds per km)
// Covers full runner range: 4:00/km competitive → 10:00/km relaxed
const PACE_MIN = 240; // 4:00/km
const PACE_MAX = 600; // 10:00/km
const PACE_STEP = 15; // 15-second increments

// Preset pace ticks with encouraging labels
const PACE_PRESETS = [
  { secondsPerKm: 240, label: 'Competitive' },
  { secondsPerKm: 270, label: 'Racing' },
  { secondsPerKm: 300, label: 'Strong' },
  { secondsPerKm: 330, label: 'Steady' },
  { secondsPerKm: 360, label: 'Comfortable' },
  { secondsPerKm: 420, label: 'Relaxed' },
  { secondsPerKm: 480, label: 'Cruising' },
  { secondsPerKm: 540, label: 'Chill' },
  { secondsPerKm: 600, label: 'Easy Going' },
];

function snapToStep(value: number): number {
  return Math.round(value / PACE_STEP) * PACE_STEP;
}

function getLabelForPace(secondsPerKm: number): string {
  // Find the closest preset label
  let closest = PACE_PRESETS[0];
  let minDiff = Math.abs(secondsPerKm - PACE_PRESETS[0].secondsPerKm);
  for (const preset of PACE_PRESETS) {
    const diff = Math.abs(secondsPerKm - preset.secondsPerKm);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }
  return closest.label;
}

function getBarHeight(index: number, total: number): number {
  // Creates a wave-like bar pattern — tallest in the middle, shorter at edges
  const center = (total - 1) / 2;
  const distance = Math.abs(index - center) / center;
  return 30 + (1 - distance) * 50; // 30% min, 80% max height
}

interface PaceSelectorProps {
  selected: number | null;
  onChange: (secondsPerKm: number | null) => void;
  unit: 'km' | 'mi';
}

export function PaceSelector({ selected, onChange, unit }: PaceSelectorProps) {
  const [isNoTarget, setIsNoTarget] = useState(selected === null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const totalSteps = Math.floor((PACE_MAX - PACE_MIN) / PACE_STEP) + 1;
  const currentStep = selected !== null
    ? Math.round((selected - PACE_MIN) / PACE_STEP)
    : Math.round((360 - PACE_MIN) / PACE_STEP); // Default to "Comfortable" position

  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current || isNoTarget) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = PACE_MIN + ratio * (PACE_MAX - PACE_MIN);
    const snapped = snapToStep(Math.max(PACE_MIN, Math.min(PACE_MAX, rawValue)));
    onChange(snapped);
  }, [onChange, isNoTarget]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSliderInteraction(e.clientX);
  }, [handleSliderInteraction]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    handleSliderInteraction(e.clientX);
  }, [handleSliderInteraction]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handlePresetClick = useCallback((secondsPerKm: number) => {
    setIsNoTarget(false);
    onChange(secondsPerKm);
  }, [onChange]);

  const handleNoTarget = useCallback(() => {
    setIsNoTarget(true);
    onChange(null);
  }, [onChange]);

  const sliderProgress = ((selected ?? 360) - PACE_MIN) / (PACE_MAX - PACE_MIN);
  const currentLabel = selected !== null ? getLabelForPace(selected) : 'No target';

  return (
    <div>
      <label className="stat-label block mb-3">Target Pace</label>

      {/* Current pace display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-white tabular-nums">
          {isNoTarget ? 'Free run' : `${formatPace(selected ?? 360, unit)}/${unit}`}
        </div>
        <div className="text-sm text-festival-orange font-medium mt-1">
          {currentLabel}
        </div>
      </div>

      {/* Bar visualization */}
      <div
        ref={sliderRef}
        className={`relative flex items-end justify-between gap-[2px] h-20 mb-2 touch-none
          ${isNoTarget ? 'opacity-30' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const pace = PACE_MIN + i * PACE_STEP;
          const isActive = !isNoTarget && selected !== null && i <= currentStep;
          const isSelected = !isNoTarget && i === currentStep;
          const height = getBarHeight(i, totalSteps);

          return (
            <div
              key={pace}
              className={`flex-1 rounded-t-sm transition-all duration-150 ${
                isSelected
                  ? 'bg-festival-orange shadow-lg shadow-festival-orange/40'
                  : isActive
                    ? 'bg-festival-orange/70'
                    : 'bg-festival-card'
              }`}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      {/* Pace range labels */}
      <div className="flex justify-between text-[10px] text-festival-muted mb-4 px-1">
        <span>{formatPace(PACE_MIN, unit)}</span>
        <span>{formatPace(PACE_MAX, unit)}</span>
      </div>

      {/* Preset quick-select buttons */}
      <div className="flex flex-wrap gap-1.5 justify-center mb-3">
        {PACE_PRESETS.filter((_, i) => i % 2 === 0 || i === PACE_PRESETS.length - 1).map((preset) => (
          <button
            key={preset.secondsPerKm}
            onClick={() => handlePresetClick(preset.secondsPerKm)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${
                !isNoTarget && selected === preset.secondsPerKm
                  ? 'bg-festival-orange text-white'
                  : 'bg-festival-card border border-festival-border text-festival-muted hover:border-festival-orange/50 hover:text-festival-text'
              }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* No target option */}
      <div className="flex justify-center">
        <button
          onClick={handleNoTarget}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all
            ${
              isNoTarget
                ? 'bg-festival-orange/10 border border-festival-orange text-festival-orange'
                : 'text-festival-muted hover:text-festival-text'
            }`}
        >
          No target — just run
        </button>
      </div>
    </div>
  );
}
