import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { CoachingPersona } from '@/types/run';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  city: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredPersona: CoachingPersona;
  storyTopics: string[];
  distanceUnit: 'km' | 'mi';
  activityTypes: string[];
  streakCurrent: number;
  streakLongest: number;
  totalDistanceMeters: number;
  totalRuns: number;
}

interface UserStore {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  fetchUser: () => Promise<void>;
  clearUser: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        set({
          user: {
            id: profile.id,
            email: authUser.email ?? '',
            name: profile.name,
            city: profile.city,
            experienceLevel: profile.experience_level ?? 'intermediate',
            preferredPersona: profile.preferred_persona ?? 'hype',
            storyTopics: profile.story_topics ?? ['history', 'science'],
            distanceUnit: profile.distance_unit ?? 'km',
            activityTypes: profile.activity_types ?? ['running'],
            streakCurrent: profile.streak_current ?? 0,
            streakLongest: profile.streak_longest ?? 0,
            totalDistanceMeters: profile.total_distance_meters ?? 0,
            totalRuns: profile.total_runs ?? 0,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Auth exists but no profile row yet (will redirect to /profile)
        set({
          user: null,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));
