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

### BUG-004: Active runners count not showing on community page
- **Severity:** Medium
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** When a runner is actively running, the community page shows "0 active runners" instead of at least 1. The `CollectiveBanner` during the run also doesn't show a runner count for real (non-demo) runs.
- **Root Cause:** `RunScreen.tsx` never called `joinPresence()` to subscribe to Supabase Realtime presence channels. Only `DemoRunScreen` set a synthetic runner count. Without joining the presence channel, the collective store's `runnerCount` stayed at 0 for real runs.
- **Files Affected:**
  - `src/components/run/RunScreen.tsx` — no presence subscription
  - `src/lib/collective/presence.ts` — `joinPresence()` existed but was never called from RunScreen
  - `src/lib/store/collective-store.ts` — `runnerCount` defaulted to 0
- **Fix:** Added `joinPresence()`, `startHeartbeat()`, and `leavePresence()` lifecycle to `RunScreen.tsx` on mount, with user/guest name and city. The presence channel's `sync` event updates `runnerCount` in the collective store.
- **Verification:** Start a real run, check that `CollectiveBanner` shows runner count. Open `/community` on another tab — should show active runners.

---

### BUG-005: Completed run not appearing on other devices
- **Severity:** High
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** After completing a run, the run does not appear on the community feed when viewed from another device. The run only exists in the local timeline store on the device that ran it.
- **Root Cause:** For authenticated users, `createRunRecord()` in the setup page could fail silently (network error, offline), leaving `runId` as null. Without a `runId`, `handleStop()` in RunScreen skips `completeRunRecord()`, so the run never reaches Supabase. Demo mode runs also skip setup entirely, never creating a DB record.
- **Files Affected:**
  - `src/app/setup/page.tsx` — `createRunRecord` can silently fail
  - `src/components/run/RunScreen.tsx` — `handleStop` requires `runId` to persist
  - `src/app/recap/page.tsx` — no fallback persistence
  - `src/lib/services/run-persistence.ts` — requires `runId` for `completeRunRecord`
- **Fix:** Added fallback persistence in recap page: if user is authenticated but has no `runId`, create the run record and complete it in one shot. Falls back to offline queue if DB write fails.
- **Verification:** Complete a run (with auth), open `/community` on another device — run should appear within 60 seconds (community page polls every 60s).

---

### BUG-006: Guest name not applied to timeline entries
- **Severity:** Medium
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** When a guest user sets their name (e.g., "Snowboarder"), completed runs in the community timeline still show "Runner" as the display name.
- **Root Cause:** The guest name prompt only appeared on the community page (`CommunityTimeline.tsx`), but the recap page adds the run to the timeline store on mount — before the user has visited the community page. The recap page used `getGuestName() ?? 'Runner'` which returned null because the name hadn't been set yet.
- **Files Affected:**
  - `src/app/setup/page.tsx` — no guest name input
  - `src/app/recap/page.tsx` — reads guest name before it's set
  - `src/components/shared/CommunityTimeline.tsx` — guest prompt only here
  - `src/lib/store/timeline-store.ts` — no method to update display name
- **Fix:**
  1. Added guest name input to setup page (`/setup`) — name is set before the run starts
  2. Added `updateRunDisplayName()` method to timeline store for retroactive name updates
  3. When guest name is set on the community page, existing "Runner" entries are retroactively updated
  4. Setup page greeting now uses guest name: "Ready when you are, Snowboarder"
- **Verification:** Open app without auth, go to `/setup`, enter name, complete a run, check that name shows in community timeline.

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

### BUG-007: Active runners count not visible cross-device
- **Severity:** High
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** Active runners count on the community page was always 0 when viewed from a different device than the runner. Presence was ephemeral only.
- **Root Cause:** The `active_runners` DB table existed but was never written to. Supabase Realtime presence channels are ephemeral — only visible between simultaneously-connected devices.
- **Fix:** Created DB-backed session tracking: `active-runners.ts` service (join/heartbeat/leave), `/api/active-runners` endpoint (count query), integrated lifecycle into `RunScreen.tsx`, community page polls DB every 30s.
- **Verification:** Start a run on device A, open `/community` on device B — should show "1 active runner".

---

### BUG-008: Mic button silently fails on iOS
- **Severity:** Medium
- **Status:** Fixed
- **Reported:** 2026-02-11
- **Description:** Tapping the mic button during a run did nothing — no listening indicator, no error feedback. Voice input appeared completely broken.
- **Root Cause:** Web Speech API errors were silently swallowed. `onerror` handler didn't log the actual error type or provide feedback to the caller. On iOS, microphone permission denials appeared as "nothing happened".
- **Fix:** Added typed `onError` callback to `VoiceInput.start()`, logged actual error types, added auto-fallback to `sendToCoach()` when mic fails so runner still gets coach interaction.
- **Verification:** Tap mic button — should either capture voice or automatically fall through to coach interaction.

---

## Test Coverage Notes

- Current: 275 tests across 26 test files
- Timeline tests: `src/__tests__/timeline.test.ts` (covers synthetic generation + store)
- Auth tests: `src/__tests__/get-site-url.test.ts` (covers `getSiteUrl()` env priority)
- Active runners tests: `src/__tests__/active-runners.test.ts` (covers join/heartbeat/leave)
- No tests for Safari PWA context, cookie isolation, or standalone mode detection
- No tests for community feed DB integration
