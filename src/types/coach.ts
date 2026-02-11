import type { CoachingPersona, RunState } from './run';

export type TriggerType =
  | 'split_complete'
  | 'pace_drift'
  | 'halfway'
  | 'final_push'
  | 'idle_storytelling'
  | 'user_initiated';

export interface CoachingTrigger {
  type: TriggerType;
  data: RunState;
}

export interface CoachingContext {
  persona: CoachingPersona;
  trigger: {
    type: TriggerType;
    data: Record<string, unknown>;
  };
  runState: {
    distanceMeters: number;
    elapsedSeconds: number;
    currentPaceSecondsPerKm: number;
    averagePaceSecondsPerKm: number;
    targetPaceSecondsPerKm: number | null;
    targetDistanceMeters: number | null;
    splits: Array<{ number: number; paceSeconds: number }>;
    isPaused: boolean;
  };
  profile: {
    name: string;
    city: string;
    experienceLevel: string;
    storyTopics: string[];
    recentRunsSummary: string;
  };
  collective: {
    runnerCount: number;
    recentEvents: Array<{ type: string; text: string }>;
    averagePaceFormatted: string;
  };
  userMessage?: string;
  conversationHistory?: {
    recentMessages: Array<{
      triggerType: TriggerType;
      summary: string;
      topics: string[];
    }>;
    topicsCovered: string[];
    lastCliffhanger: string | null;
  };
}

export interface CoachingMessage {
  triggerType: TriggerType;
  text: string;
  timestamp: number;
}

export interface PersonaVoiceConfig {
  elevenLabsVoiceId: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}
