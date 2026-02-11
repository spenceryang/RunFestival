# RunFestival Bug Bash

Tracking document for known bugs, fixes in progress, and verification status.

## Active Bugs

### BUG-001: Community feed shows only hardcoded synthetic data
- **Severity:** High
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** The community run feed at `/community` generates 25 fake runs on mount via `generateTimelineRuns()` and injects a new fake run every 15 seconds. The user's own completed run never appears. The runner count defaults to a hardcoded `342` when no live data exists.
- **Root Cause:** `CommunityTimeline.tsx` seeds the timeline store entirely with synthetic data from `src/lib/collective/timeline.ts`. No code path fetches real completed runs from the `runs` table in Supabase. The recap page (`/recap`) persists the run to the DB but never adds it to the timeline store.
- **Files Affected:**
  - `src/components/shared/CommunityTimeline.tsx` — synthetic seed + periodic injection
  - `src/lib/collective/timeline.ts` — `generateTimelineRuns()` produces all fake data
  - `src/app/community/page.tsx` — hardcoded fallback `342` runner count
  - `src/lib/store/timeline-store.ts` — store has no DB-fetch capability
- **Fix Plan:**
  1. Add `fetchRecentRuns()` service that queries completed runs from Supabase
  2. Rewrite `CommunityTimeline` to load real runs from DB on mount
  3. Add user's own run to timeline store when run completes (from recap page)
  4. Remove hardcoded `342` fallback — show nothing or "0" when no live data
- **Verification:** After fix, complete a run (demo or real) and confirm it appears in `/community` feed.

---

### BUG-002: Non-logged-in users cannot appear in community feed
- **Severity:** Medium
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** If a user is not logged in, they have no display name. Their run cannot be attributed to anyone in the community feed. There's no mechanism to set a guest name.
- **Root Cause:** The app ties identity entirely to Supabase auth. The `runs` table requires a `user_id` foreign key. Unauthenticated users in demo mode bypass auth but have no profile.
- **Files Affected:**
  - `src/lib/store/user-store.ts` — only fetches from Supabase auth
  - `src/lib/store/run-store.ts` — no guest name field
  - `src/app/recap/page.tsx` — no guest attribution
  - `src/components/shared/CommunityTimeline.tsx` — display relies on `displayName`
- **Fix Plan:**
  1. Add guest name support via localStorage (`runfestival-guest-name`)
  2. Add a name input prompt for unauthenticated users on the community page
  3. When adding a run to the local timeline, use guest name if no auth user
- **Verification:** Open app without logging in, set a guest name, complete a demo run, confirm name appears in community feed.

---

### BUG-003: Magic link authentication fails in Safari PWA (standalone mode)
- **Severity:** Critical
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** When the app is installed as a PWA on iOS Safari and the user requests a magic link, tapping the link in the email opens Safari browser (not the PWA). The session cookies are set in Safari's cookie jar, which is isolated from the PWA's cookie jar. The user remains logged out in the PWA.
- **Root Cause:** iOS Safari runs standalone PWAs in a separate security context with its own cookie storage. Magic link redirects open in Safari browser, not the PWA. Supabase session cookies set in the browser context are invisible to the PWA context. There is no bridge mechanism.
- **Files Affected:**
  - `src/app/auth/login/page.tsx` — sends magic link, shows "check email" UI
  - `src/app/auth/callback/route.ts` — exchanges code for session (runs in browser, not PWA)
  - `src/lib/supabase/client.ts` — `getSiteUrl()` may return wrong origin in PWA
  - `src/components/providers/AuthProvider.tsx` — relies on cookies for session detection
  - `public/manifest.json` — `"display": "standalone"` triggers the isolated context
- **Fix Plan:**
  1. Detect standalone PWA mode via `navigator.standalone` (iOS) or `matchMedia('(display-mode: standalone)')`
  2. When in PWA mode, show OTP code entry form instead of "check your email for a link"
  3. Use `supabase.auth.verifyOtp({ email, token, type: 'email' })` to verify the 6-digit code directly in the PWA
  4. Add localStorage-based session bridging in `AuthProvider` as a fallback: after callback in browser, store a flag; on next PWA open, attempt to recover session
- **Verification:**
  1. Install PWA on iOS Safari
  2. Request magic link — should show OTP code entry form
  3. Enter 6-digit code from email
  4. Confirm session is established within the PWA context

---

## Fixed Bugs (Historical)

See CLAUDE.md "Past Bugs & Fixes" section for previously resolved issues:
- Overlapping audio (`c1ee8b9`)
- Short stories (`8cbb0a4`)
- Repeated stories (`cf3a844`)
- onComplete returned empty string (`cf3a844`)
- Voice changed on pause/resume
- Exclusionary pace labels
- Magic link redirected to localhost

---

## Test Coverage Notes

- Current: 247 tests across 22 test files
- Timeline tests: `src/__tests__/timeline.test.ts` (covers synthetic generation + store)
- Auth tests: `src/__tests__/get-site-url.test.ts` (covers `getSiteUrl()` env priority)
- No tests for Safari PWA context, cookie isolation, or standalone mode detection
- No tests for community feed DB integration
