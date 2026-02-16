# CLAUDE.md — RunFestival

## What This Is

RunFestival is a deployed PWA that provides real-time AI voice coaching during runs. Runners hear a personalized coach in their earbuds that reacts to their pace, tells stories, and connects them to a live community of other runners.

**Production:** https://runfestival.vercel.app
**Repo:** https://github.com/spenceryang/RunFestival (private)
**Auto-deploy:** Push to `main` → Vercel builds and deploys automatically.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 14 (App Router, TypeScript) | Strict mode |
| Styling | Tailwind CSS | `festival-*` color tokens |
| State | Zustand (5 stores) | Run, coaching, collective, timeline, user |
| Auth | Supabase Auth (magic link) | Email OTP, middleware-protected routes |
| AI Coaching | Claude Opus 4.6 (streaming) | Via `/api/coach` edge route |
| TTS | OpenAI TTS `tts-1` | Via `/api/tts` edge route |
| Voice Input | Web Speech API | Browser-native, no API key |
| Maps | Mapbox GL JS | [lng, lat] order — Geolocation uses [lat, lng] |
| Presence | Supabase Realtime | City-sharded channels + global stats |
| Persistence | Supabase PostgreSQL | Runs, users, story_seeds, collective_events |
| GPS Backup | IndexedDB (idb-keyval) | Crash recovery + offline run sync |
| Deploy | Vercel (edge runtime) | Auto-deploy on push to main |

## Architecture Overview

```
GPS Tracker ──► RunStore ──► Trigger Engine (every 3s)
                                    │
                                    ▼ fires trigger
                     ┌──────────────┴──────────────┐
                     │        Context Builder       │
                     │ (run state + collective +    │
                     │  coaching history +          │
                     │  specialist agent outputs)   │
                     └──────────────┬──────────────┘
                                    │
     ┌──────────────┬───────────────┼───────────────┐
     │              │               │               │
 Pace Strategist  Motivation   Story Curator    Quality
 (rule-based)     Engine       (async Opus)     Supervisor
                  (rule-based)                  (async Opus)
                                    │
                                    ▼
                              Audio Manager
                           ┌────────┴────────┐
                           │                  │
                    POST /api/coach    POST /api/tts
                    (Opus 4.6 stream)  (OpenAI TTS per sentence)
                           │                  │
                           ▼                  ▼
                    Sentence parser ──► Web Audio API playback
                           │
                           ▼
                    CoachingStore (track what was said + quality scores)
```

## File Map

### Stores (`src/lib/store/`)
- **`run-store.ts`** — GPS points, distance, pace, splits, persona, run status, runId
- **`coaching-store.ts`** — Last 8 coaching messages, quality reviews, cached story plans
- **`collective-store.ts`** — Live runner count, events, average pace
- **`timeline-store.ts`** — Completed runs feed
- **`user-store.ts`** — Auth user profile (maps Supabase snake_case to camelCase)

### API Routes (`src/app/api/`)
- **`coach/route.ts`** — Proxies to Claude Opus 4.6. Streams SSE. 600 tokens for storytelling, 200 for alerts. Includes specialist agent outputs.
- **`tts/route.ts`** — Proxies to OpenAI TTS. Returns MP3 audio. Uses persona-specific OpenAI voices.
- **`recap/route.ts`** — Sends run stats to Claude for post-run narrative. Non-streaming, 200 tokens.
- **`story-plan/route.ts`** — Story Curator agent. Generates 3-part story plans via Opus 4.6. Async.
- **`quality/route.ts`** — Quality Supervisor agent. Reviews coaching messages. Score 1-5 + feedback. Async.
- **`active-runners/route.ts`** — Returns count of active runners from DB (heartbeat within 5 min). Uses service role key. Polled by community page every 30s.

### Specialist Agents (`src/lib/agents/`)
- **`pace-strategist.ts`** — Rule-based. Analyzes splits, projects finish time, classifies pacing strategy. Zero API cost.
- **`motivation-engine.ts`** — Rule-based. Research-backed motivation engine with 6 run phases, "how" vs "why" mindset selection, momentum detection, self-talk cues, and experience-adaptive coaching. Zero API cost.
- **`story-curator.ts`** — Generates story plans via Opus 4.6. Called async on first idle trigger. Cached for subsequent triggers.
- **`quality-supervisor.ts`** — Reviews every 3rd coaching message via Opus 4.6. Non-blocking.

### Auth (`src/lib/auth/` + `src/app/auth/` + `middleware.ts`)
- **`middleware.ts`** — Protects /setup, /run, /recap, /profile. Bypasses auth for dev mode.
- **`auth/login/page.tsx`** — Unified login/signup via magic link (Supabase OTP). Uses `getSiteUrl()` for redirect URLs.
- **`auth/callback/route.ts`** — Handles magic link redirect, exchanges code for session, redirects new users to profile onboarding.
- **`supabase/client.ts`** — Browser Supabase client + `getSiteUrl()` helper for auth redirects (priority: NEXT_PUBLIC_SITE_URL > VERCEL_URL > window.location.origin).
- **`demo-headers.ts`** — Adds X-Demo-Mode header when user is not authenticated (dev mode auth bypass).

### Services (`src/lib/services/`)
- **`run-persistence.ts`** — CRUD for runs table (createRunRecord, completeRunRecord, updateRunAiSummary).
- **`offline-sync.ts`** — Queues failed run completions in IndexedDB, syncs on next app load.
- **`active-runners.ts`** — DB-backed session tracking for active runners. `joinActiveRunners()` INSERTs into `active_runners` table on run start, `heartbeatActiveRunner()` UPDATEs `last_heartbeat` every 30s, `leaveActiveRunners()` DELETEs on run end. Enables cross-device visibility of who's running.

### Global Agents (`supabase/functions/`)
- **`race-director/`** — Scans active runners every 60s, detects patterns, generates collective moments via Opus 4.6.
- **`story-library/`** — Daily job. Generates story seeds by topic + activity type. Stored in story_seeds table.
- **`aggregate-stats/`** — Aggregates presence across city channels every 30s, publishes to runners:global.

### Voice Pipeline (`src/lib/coach/` + `src/lib/audio/`)
- **`trigger-engine.ts`** — Evaluates triggers every 3s. Priority: split > pace_drift > halfway > final_push > idle_storytelling. Min 45s between messages.
- **`context-builder.ts`** — Assembles CoachingContext from run state + collective + coaching history
- **`coach-client.ts`** — Streams Claude response, splits into sentences at `.!?` boundaries
- **`prompts.ts`** — System prompts for 4 personas + 6 trigger prompts + voice configs
- **`audio-manager.ts`** — Playback queue (max 2), interrupt/pause/resume support, sentence-level TTS streaming. Persistent HTMLAudioElement on iOS (avoids audio session conflicts). Duration-based + timeupdate watchdog completion signals. Four-layer fallback: Web Audio API → HTML `<audio>` element → SpeechSynthesis → silence.
- **`tts-client.ts`** — Calls `/api/tts`, returns ArrayBuffer per sentence
- **`fallback-tts.ts`** — Browser SpeechSynthesis when OpenAI TTS fails. Async voice loading for iOS.
- **`voice-input.ts`** — Web Speech API wrapper for runner voice commands. `onError` callback with typed error ('not-allowed', 'no-speech', etc.) for caller feedback.
- **`audio-unlock.ts`** — Shared AudioContext singleton that survives client-side navigation. Unlocked during user gesture on setup page GO button. Required for iOS audio playback.
- **`platform.ts`** — iOS detection utility (`isIOS()`). Handles iPad-as-Mac user agent.

### GPS (`src/lib/gps/`)
- **`tracker.ts`** — `watchPosition` with accuracy < 30m filter
- **`distance.ts`** — Haversine formula
- **`pace.ts`** — 30-second rolling window for current pace
- **`storage.ts`** — IndexedDB backup every 10s
- **`wake-lock.ts`** — Prevents screen sleep

### Pages (`src/app/`)
- **`/`** — Home. Auth-aware: shows profile link or login button.
- **`/auth/login`** — Magic link login.
- **`/profile`** — Profile setup/edit. Onboarding mode for new users.
- **`/setup`** — Pre-run config. Pre-fills from user preferences. Pace slider covers 4:00-10:00/km with encouraging labels.
- **`/run`** — Main run screen (GPS + coaching + agents + voice).
- **`/recap`** — Post-run map, splits, AI narrative. Persists AI summary.
- **`/dev`** — Password-gated dev mode entry (password: `claude`)
- **`/community`** — Live runner feed

## Hard Rules — Do Not Break

### Voice Pipeline
- **Latency target: <5s** from trigger to first audio word
- **Sentence-level streaming**: Send each sentence to TTS as soon as Claude finishes it — don't wait for the full response
- **Audio errors are silent**: Never show TTS errors to the user. Fall back to browser SpeechSynthesis, then to silence. The run must never crash because of audio.
- **Max queue: 2 messages**. Drop oldest if full. Don't let coaching pile up.
- **45-second minimum** between coaching messages (enforced in trigger engine)
- **User voice interrupts everything**: When the runner speaks, call `interrupt()` before enqueuing. Their response takes priority.
- **Pause/resume preserves voice**: AudioManager has `pause()` and `resume()` methods that stop playback without destroying AudioContext. This prevents voice changes when a runner pauses and resumes. `interrupt()` clears queue, `destroy()` closes AudioContext, `pause()` preserves both.

### State
- **All durations in seconds, distances in meters** internally. Convert only at display layer.
- **GPS coordinates: [lat, lng]**. Mapbox uses [lng, lat]. Convert at the Mapbox boundary.
- **Zustand stores are ephemeral** — lost on refresh. Only IndexedDB persists GPS/run state.
- **CoachingStore resets on run end** — history is per-session only.

### API Routes
- **All 3 routes are edge runtime** — no Node.js APIs, no fs, no process (except env vars).
- **API keys stay server-side** — never send Anthropic/OpenAI keys to the client. The `/api/*` routes exist specifically for this.
- **Streaming responses**: `/api/coach` and `/api/tts` both stream. Don't buffer full responses.

### Testing
- **324 tests** across 27 test files. All must pass before pushing.
- **Ask before deleting any tests.** User's explicit standing instruction.
- Run: `npx vitest run`
- Build: `npx next build`
- Both must pass before any push to main.

## Coaching System Details

### 4 Personas
| Persona | Style | OpenAI Voice | Speed |
|---------|-------|-------------|-------|
| Hype | Energetic, exclamations, celebrates | `nova` | 1.1x |
| Calm | Mindful, breathing focus, grounding | `shimmer` | 0.9x |
| Data | Analytical, stats-driven, strategic | `onyx` | 1.0x |
| Storyteller | Narratives, cliffhangers, topic-based | `fable` | 0.95x |

### 6 Trigger Types
| Trigger | When | Token Limit |
|---------|------|-------------|
| `split_complete` | Runner completes 1km | 200 |
| `pace_drift` | >15% off target for 60s | 200 |
| `halfway` | Crosses 50% of target distance | 200 |
| `final_push` | Enters last 10% of distance | 200 |
| `idle_storytelling` | 3+ min without coaching | 600 |
| `user_initiated` | Runner taps mic / speaks | 600 |

### Multi-Agent Architecture
Each run session has a **per-user agent team**:
- **Head Coach (Opus 4.6)** — owns the voice, makes final creative decisions
- **Pace Strategist (rule-based)** — analyzes splits, projects finish, classifies strategy
- **Motivation Engine (rule-based)** — research-backed: 6 run phases, "how" vs "why" mindset modes, momentum detection, self-talk cues, experience-adaptive coaching
- **Story Curator (Opus 4.6, async)** — pre-generates story plans for idle triggers
- **Quality Supervisor (Opus 4.6, async)** — reviews every 3rd message, stores feedback

Global agents (Supabase Edge Functions):
- **Race Director (Opus 4.6, every 60s)** — detects cross-runner patterns, generates collective moments
- **Story Library (Opus 4.6, daily)** — generates story seeds by topic + activity type
- **Aggregate Stats (every 30s)** — aggregates presence across city channels

See `docs/AGENTS.md` for full architecture details.

### Conversation History
- CoachingStore tracks last 8 messages with summaries + topics + cliffhanger flags
- Injected into Claude prompt as `PREVIOUS COACHING` section
- Prevents story repetition and enables multi-part story continuation
- Helper functions (regex-based, zero latency): `summarizeMessage()`, `extractTopics()`, `detectCliffhanger()`

## Known Limitations

- **TTS is not truly streaming**: `tts-client.ts` calls `response.arrayBuffer()` which buffers the full audio per sentence before playback. True chunk-level streaming would reduce latency further but requires Web Audio API chunk decoding.
- **No offline coaching**: Claude + OpenAI TTS require internet. GPS tracking works offline (IndexedDB), but coaching goes silent. Completed runs are queued and synced on next app load.
- **Global agents need scheduler**: Race Director and Story Library Edge Functions need an external cron scheduler (pg_cron or Vercel cron). Not auto-scheduled yet.
- **API cost**: Head Coach + Story Curator + Quality Supervisor use Opus 4.6 (~$0.15/run). OpenAI TTS ~$0.02/run. Total ~$0.17 per 30-min run. Monitor usage.

## Dev Mode

- **Dev mode**: `/dev` → enter password `claude` → `/run?dev=true`. Runs SF Marathon 2026 route simulation at configurable speed (10x-50x). Full coaching pipeline active. Generates 200+ synthetic runners for collective presence.

## Environment Variables

```
NEXT_PUBLIC_SITE_URL       — Production URL for auth redirects (e.g. https://runfestival.vercel.app)
ANTHROPIC_API_KEY          — Claude API (server-side only)
OPENAI_API_KEY             — OpenAI TTS (server-side only)
NEXT_PUBLIC_MAPBOX_TOKEN   — Mapbox GL JS (client-side)
NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon key
SUPABASE_SERVICE_ROLE_KEY  — Supabase admin (server-side only)
OPENWEATHER_API_KEY        — Weather data (unused currently)
```

**Important:** `NEXT_PUBLIC_SITE_URL` must be set in Vercel environment variables to `https://runfestival.vercel.app` for production magic link redirects to work. Without it, magic links will redirect to localhost. Also ensure this URL is whitelisted in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.

## Past Bugs & Fixes (Learn From These)

1. **Overlapping audio** (fixed in `c1ee8b9`): `processQueue` in AudioManager had a race condition — `onComplete` could start a second concurrent sentence-processing loop. Fixed with `isProcessing` lock + `interrupted` flag + `interrupt()` method.

2. **Short stories** (fixed in `8cbb0a4`): `max_tokens: 150` was hardcoded for all triggers. Stories need 400 tokens. Made dynamic based on trigger type.

3. **Repeated stories** (fixed in `cf3a844`): Every Claude call was stateless — no memory of previous messages. Added CoachingStore + PREVIOUS COACHING prompt section + cliffhanger continuation.

4. **onComplete returned empty string** (fixed in `cf3a844`): `coach-client.ts` passed the sliced `fullText` remainder to `onComplete` instead of the full response. Added separate `collectedFullText` accumulator.

5. **Voice changed on pause/resume**: The coaching `useEffect` in `run/page.tsx` had `store.status` in its dependency array. When status changed (`running` → `paused` → `running`), the effect destroyed and recreated AudioManager, closing the AudioContext. Mid-flight ElevenLabs requests would fail and fall back to browser SpeechSynthesis (different voice). Fixed by: (a) splitting the monolithic effect into 3 (redirect, coaching lifecycle mount-only, pause/resume audio), (b) adding `pause()`/`resume()` to AudioManager that stop playback without destroying AudioContext, (c) using callback refs to avoid stale closures in the mount-only interval.

6. **Exclusionary pace labels**: Old PaceSelector had labels like "Easy" at 6:30/km and maxed at 6:30, alienating slower runners. Redesigned with inclusive labels ("Competitive" → "Easy Going"), extended range to 10:00/km, slider with visual bars, and "No target — just run" option. Goal: encourage everyone to run more.

8. **Silent voice coaching on iOS** (Safari PWA + Chrome on iOS): AudioContext was created in timer callback (not user gesture), so iOS kept it suspended. `decodeAudioData()` failed silently, and the SpeechSynthesis fallback also failed because `getVoices()` returns empty array on iOS (voices load async). Fixed by: (a) creating `audio-unlock.ts` — a shared AudioContext singleton unlocked during the setup page GO button tap (a real user gesture), (b) adding HTML `<audio>` element as second fallback in `audio-manager.ts` that bypasses Web Audio API entirely, (c) rewriting `fallback-tts.ts` to wait for `voiceschanged` event, reject on errors (was resolving), and add stuck-speech timeout, (d) adding `platform.ts` for iOS detection including iPad-as-Mac. Playback chain: Web Audio API → HTML Audio → SpeechSynthesis → silence.

7. **Magic link redirected to localhost**: Login page used `window.location.origin` for the magic link redirect URL, which resolved to `http://localhost:3000` in dev. In production, Supabase needs the production URL whitelisted. Fixed by: (a) adding `getSiteUrl()` helper that prioritizes `NEXT_PUBLIC_SITE_URL` env var > `NEXT_PUBLIC_VERCEL_URL` > `window.location.origin`, (b) using `getSiteUrl()` in both login page and callback route, (c) adding `NEXT_PUBLIC_SITE_URL` env var. Also fixed: no sign-up flow (unified login/signup page), no sign-out button (added dropdown menu on home page + sign-out on profile page), "Welcome Back" copy alienated new users (changed to "Join the Run").

9. **Active runners not visible cross-device**: The `active_runners` DB table existed in the schema (with heartbeat cleanup, RLS policies, Realtime publication) but was never written to. All presence tracking relied on ephemeral Supabase Realtime channels — only worked between devices simultaneously subscribed to the same channel. Fixed by: (a) creating `active-runners.ts` service that INSERTs on run start, UPDATEs heartbeat every 30s, DELETEs on run end, (b) adding `/api/active-runners` endpoint that queries count of active runners (heartbeat within 5 min), (c) integrating join/heartbeat/leave lifecycle into `RunScreen.tsx`, (d) community page polls `/api/active-runners` every 30s for cross-device visibility.

10. **Mic button didn't capture voice**: Web Speech API errors were silently swallowed — `onerror` handler didn't log the actual error type (`event.error` can be 'not-allowed', 'no-speech', 'aborted', etc.) and provided no feedback to the caller. On iOS, microphone permission failures appeared as "nothing happened" with no indication of why. Fixed by: (a) adding typed `onError` callback to `VoiceInput.start()`, (b) logging actual error type in `onerror` handler, (c) in `run/page.tsx`, passing error callback that automatically falls through to `sendToCoach()` when mic fails — runner still gets coach interaction even without voice.

11. **iOS audio stopped after first sentence** (v3): Coach said "hey" then went silent — first sentence played but subsequent sentences never started. Root cause: `playWithHtmlAudio()` created a new `HTMLAudioElement` per sentence, and iOS WebKit's `onended` event is unreliable for short audio clips (<2s). The Promise never resolved, blocking the `processQueue` while loop. Fixed by: (a) reusing a persistent `HTMLAudioElement` on iOS instead of creating new ones per sentence (avoids audio session conflicts), (b) replacing the 30s safety timeout with a duration-based timeout (`audio.duration * 1000 + 500ms`), (c) adding a `timeupdate` watchdog that detects stalled playback within 2s, (d) adding `playsInline`/`webkit-playsinline` hints on all Audio elements, (e) adding `touchstart` warm-up alongside `pointerdown` for iOS gesture detection, (f) interrupting coach playback before mic capture to prevent iOS audio session conflicts, (g) adding duplicate callback guard in `VoiceInput` for iOS WebKit's onerror+onend double-fire quirk.

## Definition of Done (Engineering Standards)

Every feature implementation must complete ALL of the following before being considered done:

### Code Quality
1. **All existing tests pass** — Run `npx vitest run` (currently 266 tests across 25 files)
2. **Clean build** — Run `npx next build` with zero errors and zero warnings
3. **No regressions** — Verify the change doesn't break existing functionality
4. **Ask before deleting tests** — User's explicit standing instruction

### Documentation
5. **Update CLAUDE.md** — If the change adds new files, patterns, hard rules, or bug fixes
6. **Update docs/AGENTS.md** — If the change affects agent architecture, data flow, or storage
7. **Update test count** — Keep the test count in CLAUDE.md accurate after adding/removing tests

### New Tests
8. **Write tests for new logic** — Any new utility, store method, agent, or complex component
9. **Edge cases covered** — Test error paths, boundary conditions, and state transitions
10. **Mocks are realistic** — Mock external APIs (AudioContext, speechSynthesis, fetch) at the boundary

### UX Standards
11. **Mobile-first** — All interactions work with touch (pointer events, not just click)
12. **Destructive actions require confirmation** — Stop/delete/reset must confirm before executing
13. **Visual state feedback** — Paused, loading, error, and active states must be visually distinct
14. **Inclusive language** — No judgmental labels (avoid "easy", "slow", "beginner" in user-facing text)
15. **Silent error handling** — Audio/TTS errors never crash the app or show raw errors to users

### Git Discipline
16. **Commit messages explain why** — Not just what changed
17. **Atomic commits** — One logical change per commit
18. **Never push broken builds** — Tests + build must pass before `git push`
