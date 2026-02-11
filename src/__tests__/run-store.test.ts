import { describe, it, expect, beforeEach } from 'vitest';
import { useRunStore } from '@/lib/store/run-store';

describe('useRunStore', () => {
  beforeEach(() => {
    useRunStore.getState().resetRun();
  });

  it('starts in idle status', () => {
    expect(useRunStore.getState().status).toBe('idle');
  });

  it('startRun sets status to running and stores config', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: 300,
      persona: 'hype',
    });

    const state = useRunStore.getState();
    expect(state.status).toBe('running');
    expect(state.targetDistanceMeters).toBe(5000);
    expect(state.targetPaceSecondsPerKm).toBe(300);
    expect(state.persona).toBe('hype');
    expect(state.distanceMeters).toBe(0);
    expect(state.startedAt).not.toBeNull();
  });

  it('startRun handles null targets', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: null,
      targetPaceSecondsPerKm: null,
      persona: 'calm',
    });

    const state = useRunStore.getState();
    expect(state.targetDistanceMeters).toBeNull();
    expect(state.targetPaceSecondsPerKm).toBeNull();
  });

  it('addGpsPoint accumulates distance', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: null,
      persona: 'data',
    });

    const now = Date.now();
    useRunStore.getState().addGpsPoint({
      lat: 37.7749,
      lng: -122.4194,
      altitude: null,
      speed: null,
      timestamp: now,
      accuracy: 5,
    });

    useRunStore.getState().addGpsPoint({
      lat: 37.7758, // ~100m north
      lng: -122.4194,
      altitude: null,
      speed: null,
      timestamp: now + 3000,
      accuracy: 5,
    });

    const state = useRunStore.getState();
    expect(state.gpsPoints).toHaveLength(2);
    expect(state.distanceMeters).toBeGreaterThan(50);
    expect(state.distanceMeters).toBeLessThan(200);
  });

  it('addGpsPoint detects split completion', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: null,
      persona: 'hype',
    });

    // Simulate crossing 1km by adding points far apart
    const now = Date.now();
    useRunStore.getState().addGpsPoint({
      lat: 37.7749, lng: -122.4194, altitude: null, speed: null,
      timestamp: now, accuracy: 5,
    });

    // Jump ~1.1km north
    useRunStore.getState().updateElapsedTime(300);
    useRunStore.getState().addGpsPoint({
      lat: 37.7849, lng: -122.4194, altitude: null, speed: null,
      timestamp: now + 300000, accuracy: 5,
    });

    const state = useRunStore.getState();
    expect(state.currentSplit).toBeGreaterThanOrEqual(1);
    expect(state.splits.length).toBeGreaterThanOrEqual(1);
  });

  it('pauseRun sets status to paused', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: null,
      targetPaceSecondsPerKm: null,
      persona: 'hype',
    });
    useRunStore.getState().pauseRun();
    expect(useRunStore.getState().status).toBe('paused');
  });

  it('resumeRun sets status back to running', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: null,
      targetPaceSecondsPerKm: null,
      persona: 'hype',
    });
    useRunStore.getState().pauseRun();
    useRunStore.getState().resumeRun();
    expect(useRunStore.getState().status).toBe('running');
  });

  it('finishRun sets status to finished', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: null,
      targetPaceSecondsPerKm: null,
      persona: 'hype',
    });
    useRunStore.getState().finishRun();
    expect(useRunStore.getState().status).toBe('finished');
  });

  it('resetRun clears all state', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: 5000,
      targetPaceSecondsPerKm: 300,
      persona: 'data',
    });
    useRunStore.getState().addGpsPoint({
      lat: 37.7749, lng: -122.4194, altitude: null, speed: null,
      timestamp: Date.now(), accuracy: 5,
    });
    useRunStore.getState().updateElapsedTime(100);
    useRunStore.getState().resetRun();

    const state = useRunStore.getState();
    expect(state.status).toBe('idle');
    expect(state.distanceMeters).toBe(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.gpsPoints).toHaveLength(0);
    expect(state.splits).toHaveLength(0);
    expect(state.startedAt).toBeNull();
  });

  it('updateElapsedTime updates seconds', () => {
    useRunStore.getState().startRun({
      targetDistanceMeters: null,
      targetPaceSecondsPerKm: null,
      persona: 'hype',
    });
    useRunStore.getState().updateElapsedTime(42);
    expect(useRunStore.getState().elapsedSeconds).toBe(42);
  });

  it('setDistanceUnit updates unit', () => {
    useRunStore.getState().setDistanceUnit('mi');
    expect(useRunStore.getState().distanceUnit).toBe('mi');
    useRunStore.getState().setDistanceUnit('km');
    expect(useRunStore.getState().distanceUnit).toBe('km');
  });
});
