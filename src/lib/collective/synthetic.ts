/**
 * Synthetic runner data for demo mode.
 * These simulate real runners for the collective presence display.
 */

const CITIES = [
  'San Francisco', 'New York', 'London', 'Tokyo', 'Berlin',
  'Sydney', 'Toronto', 'Singapore', 'Paris', 'Austin',
  'Portland', 'Chicago', 'Seattle', 'Boston', 'Denver',
  'Amsterdam', 'Barcelona', 'Melbourne', 'Vancouver', 'Miami',
];

const FIRST_NAMES = [
  'Sarah', 'Marcus', 'Yuki', 'Priya', 'Carlos', 'Emma', 'Liam', 'Aisha',
  'Noah', 'Mia', 'Jin', 'Sofia', 'Oliver', 'Luna', 'Leo', 'Ava',
  'Ethan', 'Chloe', 'Kai', 'Zara', 'Felix', 'Nora', 'Ravi', 'Elena',
  'Sam', 'Maya', 'Alex', 'Rosa', 'Max', 'Lily', 'Ben', 'Ada',
];

export interface SyntheticRunner {
  userId: string;
  displayName: string;
  city: string;
  currentPace: number;
  distanceMeters: number;
  startedMinutesAgo: number;
}

export function generateSyntheticRunners(count: number): SyntheticRunner[] {
  const runners: SyntheticRunner[] = [];
  for (let i = 0; i < count; i++) {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const pace = 300 + Math.random() * 180; // 5:00 - 8:00 /km
    const startedMinutesAgo = Math.random() * 45;
    const distanceMeters = (startedMinutesAgo * 60) / pace * 1000;

    runners.push({
      userId: `synthetic-${i}-${Date.now()}`,
      displayName: name,
      city,
      currentPace: pace,
      distanceMeters,
      startedMinutesAgo,
    });
  }
  return runners;
}

/**
 * Generate a random milestone event from a synthetic runner.
 */
export function generateSyntheticMilestone(): { name: string; city: string; achievement: string } {
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const achievements = [
    'just completed a 5K',
    'hit a new personal best',
    'just finished their first 10K',
    'crushed their pace goal',
    'reached 100km this month',
    'is on a 7-day streak',
    'just started their run',
    'negative-split their last km',
  ];
  const achievement = achievements[Math.floor(Math.random() * achievements.length)];
  return { name, city, achievement };
}
