import { describe, it, expect, beforeEach } from 'vitest';
import { useCollectiveStore } from '@/lib/store/collective-store';

describe('useCollectiveStore', () => {
  beforeEach(() => {
    useCollectiveStore.getState().reset();
  });

  it('starts with zero runners', () => {
    expect(useCollectiveStore.getState().runnerCount).toBe(0);
  });

  it('setRunnerCount updates count', () => {
    useCollectiveStore.getState().setRunnerCount(342);
    expect(useCollectiveStore.getState().runnerCount).toBe(342);
  });

  it('addEvent adds to front of list', () => {
    useCollectiveStore.getState().addEvent({
      type: 'milestone',
      text: 'First event',
      timestamp: 1000,
    });
    useCollectiveStore.getState().addEvent({
      type: 'collective_stat',
      text: 'Second event',
      timestamp: 2000,
    });

    const events = useCollectiveStore.getState().recentEvents;
    expect(events).toHaveLength(2);
    expect(events[0].text).toBe('Second event');
    expect(events[1].text).toBe('First event');
  });

  it('limits events to 10', () => {
    for (let i = 0; i < 15; i++) {
      useCollectiveStore.getState().addEvent({
        type: 'milestone',
        text: `Event ${i}`,
        timestamp: i * 1000,
      });
    }

    expect(useCollectiveStore.getState().recentEvents).toHaveLength(10);
    expect(useCollectiveStore.getState().recentEvents[0].text).toBe('Event 14');
  });

  it('setAveragePace updates pace', () => {
    useCollectiveStore.getState().setAveragePace(348);
    expect(useCollectiveStore.getState().averagePaceSecondsPerKm).toBe(348);
  });

  it('setTotalDistance updates distance', () => {
    useCollectiveStore.getState().setTotalDistance(5000000);
    expect(useCollectiveStore.getState().totalDistanceToday).toBe(5000000);
  });

  it('reset clears everything', () => {
    useCollectiveStore.getState().setRunnerCount(500);
    useCollectiveStore.getState().addEvent({
      type: 'milestone',
      text: 'test',
      timestamp: 1000,
    });
    useCollectiveStore.getState().setAveragePace(300);
    useCollectiveStore.getState().setTotalDistance(1000);

    useCollectiveStore.getState().reset();

    const state = useCollectiveStore.getState();
    expect(state.runnerCount).toBe(0);
    expect(state.recentEvents).toHaveLength(0);
    expect(state.averagePaceSecondsPerKm).toBe(0);
    expect(state.totalDistanceToday).toBe(0);
  });
});
