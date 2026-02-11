import { get, set, del } from 'idb-keyval';
import { completeRunRecord, type CompleteRunParams } from './run-persistence';

const PENDING_RUNS_KEY = 'runfestival_pending_runs';

/**
 * Queues run completion data in IndexedDB for later sync.
 * Used when Supabase is unreachable at run finish time.
 */
export async function queueRunForSync(runData: CompleteRunParams): Promise<void> {
  try {
    const pending = (await get<CompleteRunParams[]>(PENDING_RUNS_KEY)) ?? [];
    pending.push(runData);
    await set(PENDING_RUNS_KEY, pending);
  } catch {
    console.warn('Failed to queue run for offline sync');
  }
}

/**
 * Attempts to sync all pending runs to Supabase.
 * Called on app load when user is authenticated.
 * Removes successfully synced runs from the queue.
 */
export async function syncPendingRuns(): Promise<void> {
  try {
    const pending = (await get<CompleteRunParams[]>(PENDING_RUNS_KEY)) ?? [];
    if (pending.length === 0) return;

    const remaining: CompleteRunParams[] = [];

    for (const run of pending) {
      const success = await completeRunRecord(run);
      if (!success) {
        remaining.push(run);
      }
    }

    if (remaining.length === 0) {
      await del(PENDING_RUNS_KEY);
    } else {
      await set(PENDING_RUNS_KEY, remaining);
    }
  } catch {
    // Silent — will retry on next app load
  }
}
