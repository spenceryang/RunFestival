'use client';

import { Flame, Wind, BarChart3, BookOpen } from 'lucide-react';
import type { CoachingPersona } from '@/types/run';

const PERSONAS: Array<{
  id: CoachingPersona;
  name: string;
  description: string;
  icon: typeof Flame;
}> = [
  {
    id: 'hype',
    name: 'Hype Coach',
    description: 'High energy, like a Peloton instructor',
    icon: Flame,
  },
  {
    id: 'calm',
    name: 'Calm Guide',
    description: 'Zen, mindfulness, breathing',
    icon: Wind,
  },
  {
    id: 'data',
    name: 'Data Nerd',
    description: 'Splits, pacing strategy, numbers',
    icon: BarChart3,
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    description: 'Fascinating stories to pass the miles',
    icon: BookOpen,
  },
];

interface PersonaSelectorProps {
  selected: CoachingPersona;
  onChange: (persona: CoachingPersona) => void;
}

export function PersonaSelector({ selected, onChange }: PersonaSelectorProps) {
  return (
    <div>
      <label className="stat-label block mb-3">Coach Persona</label>
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isSelected = selected === persona.id;
          return (
            <button
              key={persona.id}
              onClick={() => onChange(persona.id)}
              className={`p-4 rounded-xl text-left transition-all flex items-start gap-3
                ${
                  isSelected
                    ? 'bg-festival-orange/10 border-2 border-festival-orange'
                    : 'bg-festival-card border border-festival-border hover:border-festival-orange/50'
                }`}
            >
              <Icon
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  isSelected ? 'text-festival-orange' : 'text-festival-muted'
                }`}
              />
              <div>
                <div className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-festival-text'}`}>
                  {persona.name}
                </div>
                <div className="text-xs text-festival-muted mt-0.5">
                  {persona.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
