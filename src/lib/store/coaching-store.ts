import { create } from 'zustand';
import type { TriggerType } from '@/types/coach';

export interface CoachingHistoryEntry {
  triggerType: TriggerType;
  text: string;
  summary: string;
  topics: string[];
  hasCliffhanger: boolean;
  userMessage?: string;
  timestamp: number;
}

interface CoachingStore {
  history: CoachingHistoryEntry[];

  addMessage: (entry: CoachingHistoryEntry) => void;
  getRecentHistory: (count?: number) => CoachingHistoryEntry[];
  getTopicsCovered: () => string[];
  getLastCliffhanger: () => string | null;
  reset: () => void;
}

const MAX_HISTORY = 8;

export const useCoachingStore = create<CoachingStore>((set, get) => ({
  history: [],

  addMessage: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, MAX_HISTORY),
    })),

  getRecentHistory: (count = 5) => get().history.slice(0, count),

  getTopicsCovered: () => {
    const all = get().history.flatMap((h) => h.topics);
    return Array.from(new Set(all));
  },

  getLastCliffhanger: () => {
    const last = get().history.find((h) => h.hasCliffhanger);
    if (!last) return null;
    // Return the last sentence of the cliffhanger message
    const sentences = last.text.match(/[^.!?]+[.!?]+/g);
    return sentences ? sentences[sentences.length - 1].trim() : last.text.slice(-100);
  },

  reset: () => set({ history: [] }),
}));

// --- Helper functions (zero-latency, regex-based) ---

export function summarizeMessage(text: string): string {
  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] ?? text;
  return firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;
}

export function extractTopics(text: string): string[] {
  // Capitalized multi-word phrases (proper nouns / story subjects)
  const properNouns: string[] = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) ?? [];
  // Quoted phrases
  const quoted: string[] = text.match(/"([^"]+)"/g)?.map((q) => q.replace(/"/g, '')) ?? [];
  return Array.from(new Set(properNouns.concat(quoted))).slice(0, 5);
}

export function detectCliffhanger(text: string): boolean {
  const patterns = [
    /to be continued/i,
    /I'll tell you/i,
    /next time/i,
    /but that's a story for/i,
    /want to know what happened/i,
    /\.\.\.$/,
  ];
  return patterns.some((p) => p.test(text));
}
