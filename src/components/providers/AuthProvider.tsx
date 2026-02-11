'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/lib/store/user-store';
import { syncPendingRuns } from '@/lib/services/offline-sync';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchUser = useUserStore((s) => s.fetchUser);
  const clearUser = useUserStore((s) => s.clearUser);

  useEffect(() => {
    const supabase = createClient();

    // Check initial session and sync pending runs
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUser().then(() => {
          syncPendingRuns().catch(() => { /* silent */ });
        });
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchUser();
      } else if (event === 'SIGNED_OUT') {
        clearUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUser, clearUser]);

  return <>{children}</>;
}
