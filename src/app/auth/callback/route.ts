import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // Called from Server Component — safe to ignore
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch {
              // Called from Server Component — safe to ignore
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if user has a profile row
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!profile) {
          // First login — redirect to profile setup
          return NextResponse.redirect(
            new URL('/profile?onboarding=true', origin)
          );
        }
      }

      return NextResponse.redirect(new URL(redirect, origin));
    }
  }

  // Auth error — redirect back to login
  return NextResponse.redirect(new URL('/auth/login?error=auth', origin));
}
