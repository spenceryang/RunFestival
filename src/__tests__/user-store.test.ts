import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserStore } from '@/lib/store/user-store';

const mockSignOut = vi.fn().mockResolvedValue({});

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      signOut: mockSignOut,
    },
    from: vi.fn(),
  }),
  getSiteUrl: () => 'http://localhost:3000',
}));

describe('useUserStore', () => {
  beforeEach(() => {
    useUserStore.getState().clearUser();
  });

  it('starts with null user and not authenticated', () => {
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('clearUser resets to default state', () => {
    // Simulate having a user by setting state directly
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test Runner',
        city: null,
        experienceLevel: 'intermediate',
        preferredPersona: 'hype',
        storyTopics: [],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 0,
        streakLongest: 0,
        totalDistanceMeters: 0,
        totalRuns: 0,
      },
      isAuthenticated: true,
    });

    useUserStore.getState().clearUser();

    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('updateUser merges partial updates into existing user', () => {
    // Set initial user manually via store internals
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test Runner',
        city: null,
        experienceLevel: 'intermediate',
        preferredPersona: 'hype',
        storyTopics: ['history', 'science'],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 0,
        streakLongest: 0,
        totalDistanceMeters: 0,
        totalRuns: 0,
      },
      isAuthenticated: true,
    });

    useUserStore.getState().updateUser({
      name: 'Updated Runner',
      city: 'San Francisco',
      experienceLevel: 'advanced',
    });

    const state = useUserStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.user!.name).toBe('Updated Runner');
    expect(state.user!.city).toBe('San Francisco');
    expect(state.user!.experienceLevel).toBe('advanced');
    // Unchanged fields preserved
    expect(state.user!.email).toBe('test@example.com');
    expect(state.user!.preferredPersona).toBe('hype');
    expect(state.user!.storyTopics).toEqual(['history', 'science']);
  });

  it('updateUser does nothing when user is null', () => {
    useUserStore.getState().updateUser({ name: 'Ghost' });
    expect(useUserStore.getState().user).toBeNull();
  });

  it('updateUser can change persona and topics', () => {
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test',
        city: null,
        experienceLevel: 'beginner',
        preferredPersona: 'hype',
        storyTopics: [],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 0,
        streakLongest: 0,
        totalDistanceMeters: 0,
        totalRuns: 0,
      },
      isAuthenticated: true,
    });

    useUserStore.getState().updateUser({
      preferredPersona: 'storyteller',
      storyTopics: ['history', 'music', 'food'],
      activityTypes: ['running', 'hiking'],
    });

    const user = useUserStore.getState().user!;
    expect(user.preferredPersona).toBe('storyteller');
    expect(user.storyTopics).toEqual(['history', 'music', 'food']);
    expect(user.activityTypes).toEqual(['running', 'hiking']);
  });

  it('updateUser can update distance unit', () => {
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test',
        city: null,
        experienceLevel: 'intermediate',
        preferredPersona: 'hype',
        storyTopics: [],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 0,
        streakLongest: 0,
        totalDistanceMeters: 0,
        totalRuns: 0,
      },
      isAuthenticated: true,
    });

    useUserStore.getState().updateUser({ distanceUnit: 'mi' });
    expect(useUserStore.getState().user!.distanceUnit).toBe('mi');
  });

  it('updateUser preserves streak and stats', () => {
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Runner',
        city: 'NYC',
        experienceLevel: 'advanced',
        preferredPersona: 'data',
        storyTopics: ['science'],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 7,
        streakLongest: 14,
        totalDistanceMeters: 50000,
        totalRuns: 10,
      },
      isAuthenticated: true,
    });

    useUserStore.getState().updateUser({ name: 'Super Runner' });

    const user = useUserStore.getState().user!;
    expect(user.name).toBe('Super Runner');
    expect(user.streakCurrent).toBe(7);
    expect(user.streakLongest).toBe(14);
    expect(user.totalDistanceMeters).toBe(50000);
    expect(user.totalRuns).toBe(10);
  });

  it('signOut calls supabase.auth.signOut and clears local state', async () => {
    // Set up an authenticated user
    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Runner',
        city: null,
        experienceLevel: 'intermediate',
        preferredPersona: 'hype',
        storyTopics: [],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 5,
        streakLongest: 10,
        totalDistanceMeters: 25000,
        totalRuns: 5,
      },
      isAuthenticated: true,
    });

    await useUserStore.getState().signOut();

    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signOut clears local state even if supabase signOut fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network error'));

    useUserStore.setState({
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Runner',
        city: null,
        experienceLevel: 'intermediate',
        preferredPersona: 'hype',
        storyTopics: [],
        distanceUnit: 'km',
        activityTypes: ['running'],
        streakCurrent: 0,
        streakLongest: 0,
        totalDistanceMeters: 0,
        totalRuns: 0,
      },
      isAuthenticated: true,
    });

    // Should not throw even when Supabase fails
    await useUserStore.getState().signOut();

    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
