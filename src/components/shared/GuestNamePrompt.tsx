'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { setGuestName } from '@/lib/guest-name';

interface GuestNamePromptProps {
  onDone: () => void;
}

export function GuestNamePrompt({ onDone }: GuestNamePromptProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setGuestName(trimmed);
    onDone();
  };

  return (
    <div className="card mb-4 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-festival-text">
          <User className="w-4 h-4 text-festival-orange" />
          <span>What should we call you?</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="flex-1 px-3 py-2 rounded-lg bg-festival-dark border border-festival-border
                       text-white placeholder-festival-muted/50 text-sm
                       focus:outline-none focus:border-festival-orange transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-festival-orange text-white text-sm font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-[0.97] transition-transform"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
