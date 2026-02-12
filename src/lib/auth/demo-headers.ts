import { useUserStore } from '@/lib/store/user-store';

/**
 * Returns headers to send with API requests.
 * When not authenticated (dev mode), adds X-Demo-Mode header
 * so the API routes skip auth validation.
 */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const isAuthenticated = useUserStore.getState().isAuthenticated;
  if (!isAuthenticated) {
    headers['X-Demo-Mode'] = 'true';
  }

  return headers;
}
