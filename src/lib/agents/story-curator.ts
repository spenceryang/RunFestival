/**
 * Story Curator agent — plans multi-part stories for idle_storytelling triggers.
 * Uses Opus 4.6 for creative story planning. Runs async (non-blocking).
 * Results are cached in the coaching store for the Head Coach to use.
 */

export interface StoryPlan {
  title: string;
  topic: string;
  arc: {
    part1: string;
    part2: string;
    part3: string;
  };
  keyFacts: string[];
  activityType: string;
}

export interface StoryCuratorInput {
  userInterests: string[];
  activityType: string;
  topicsCovered: string[];
  persona: string;
}

/**
 * Generates a story plan via Claude Opus 4.6.
 * Called async after the first idle trigger — result cached for subsequent triggers.
 */
export async function generateStoryPlan(
  input: StoryCuratorInput
): Promise<StoryPlan | null> {
  try {
    const response = await fetch('/api/story-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.plan as StoryPlan;
  } catch {
    return null;
  }
}

/**
 * Selects the best topic for a new story based on user interests
 * and topics already covered. Pure logic, no API call.
 */
export function selectNextTopic(
  userInterests: string[],
  topicsCovered: string[]
): string {
  // Find interests not yet covered
  const uncovered = userInterests.filter(
    (t) => !topicsCovered.some((c) => c.toLowerCase().includes(t.toLowerCase()))
  );

  if (uncovered.length > 0) {
    // Pick a random uncovered topic
    return uncovered[Math.floor(Math.random() * uncovered.length)];
  }

  // All covered — cycle back to the least recently covered
  if (userInterests.length > 0) {
    return userInterests[0];
  }

  // Fallback topics
  const fallbacks = ['history', 'science', 'nature', 'culture', 'sports'];
  const uncoveredFallback = fallbacks.filter(
    (t) => !topicsCovered.some((c) => c.toLowerCase().includes(t.toLowerCase()))
  );

  return uncoveredFallback[0] ?? 'history';
}
