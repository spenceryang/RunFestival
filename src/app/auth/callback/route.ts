import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? '/';

  // Use NEXT_PUBLIC_SITE_URL for consistent redirect base URL,
  // falling back to request origin (which may be localhost in dev)
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : new URL(request.url).origin);

  if (!code) {
    return NextResponse.redirect(
      new URL('/auth/login?error=auth', siteUrl)
    );
  }

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

  if (error) {
    // Code exchange failed — expired link, already used, etc.
    return NextResponse.redirect(
      new URL('/auth/login?error=auth', siteUrl)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unlikely: code exchanged but no user — session issue
    return NextResponse.redirect(
      new URL('/auth/login?error=session', siteUrl)
    );
  }

  // Check if user has a profile row
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // First login — redirect to profile setup (onboarding)
    return NextResponse.redirect(
      new URL('/profile?onboarding=true', siteUrl)
    );
  }

  // Existing user — redirect to their intended destination
  return NextResponse.redirect(new URL(redirect, siteUrl));
}
