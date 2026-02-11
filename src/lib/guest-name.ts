const GUEST_NAME_KEY = 'runfestival-guest-name';

/**
 * Get the stored guest name from localStorage.
 * Returns null if not set or localStorage unavailable.
 */
export function getGuestName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GUEST_NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Store a guest name in localStorage.
 */
export function setGuestName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_NAME_KEY, name.trim());
  } catch {
    // localStorage unavailable — silently ignore
  }
}
