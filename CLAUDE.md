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
| TTS | ElevenLabs `eleven_turbo_v2_5` | Via `/api/tts` edge route |
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
                    (Opus 4.6 stream)  (ElevenLabs per sentence)
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
- **`tts/route.ts`** — Proxies to ElevenLabs. Streams MP3 audio. Uses persona-specific voice IDs.
- **`recap/route.ts`** — Sends run stats to Claude for post-run narrative. Non-streaming, 200 tokens.
- **`story-plan/route.ts`** — Story Curator agent. Generates 3-part story plans via Opus 4.6. Async.
- **`quality/route.ts`** — Quality Supervisor agent. Reviews coaching messages. Score 1-5 + feedback. Async.

### Specialist Agents (`src/lib/agents/`)
- **`pace-strategist.ts`** — Rule-based. Analyzes splits, projects finish time, classifies pacing strategy. Zero API cost.
- **`motivation-engine.ts`** — Rule-based. Detects struggle vs flow state from pace trends. Zero API cost.
- **`story-curator.ts`** — Generates story plans via Opus 4.6. Called async on first idle trigger. Cached for subsequent triggers.
- **`quality-supervisor.ts`** — Reviews every 3rd coaching message via Opus 4.6. Non-blocking.

### Auth (`src/lib/auth/` + `src/app/auth/` + `middleware.ts`)
- **`middleware.ts`** — Protects /setup, /run, /recap, /profile. Bypasses auth for ?demo=true.
- **`auth/login/page.tsx`** — Magic link login (Supabase OTP).
- **`auth/callback/route.ts`** — Handles magic link redirect + profile check.
- **`demo-headers.ts`** — Adds X-Demo-Mode header when user is not authenticated.

### Services (`src/lib/services/`)
- **`run-persistence.ts`** — CRUD for runs table (createRunRecord, completeRunRecord, updateRunAiSummary).
- **`offline-sync.ts`** — Queues failed run completions in IndexedDB, syncs on next app load.

### Global Agents (`supabase/functions/`)
- **`race-director/`** — Scans active runners every 60s, detects patterns, generates collective moments via Opus 4.6.
- **`story-library/`** — Daily job. Generates story seeds by topic + activity type. Stored in story_seeds table.
- **`aggregate-stats/`** — Aggregates presence across city channels every 30s, publishes to runners:global.

### Voice Pipeline (`src/lib/coach/` + `src/lib/audio/`)
- **`trigger-engine.ts`** — Evaluates triggers every 3s. Priority: split > pace_drift > halfway > final_push > idle_storytelling. Min 45s between messages.
- **`context-builder.ts`** — Assembles CoachingContext from run state + collective + coaching history
- **`coach-client.ts`** — Streams Claude response, splits into sentences at `.!?` boundaries
- **`prompts.ts`** — System prompts for 4 personas + 6 trigger prompts + voice configs
- **`audio-manager.ts`** — Playback queue (max 2), interrupt support, sentence-level TTS streaming
- **`tts-client.ts`** — Calls `/api/tts`, returns ArrayBuffer per sentence
- **`fallback-tts.ts`** — Browser SpeechSynthesis when ElevenLabs fails
- **`voice-input.ts`** — Web Speech API wrapper for runner voice commands

### GPS (`src/lib/gps/`)
- **`tracker.ts`** — `watchPosition` with accuracy < 30m filter
- **`distance.ts`** — Haversine formula
- **`pace.ts`** — 30-second rolling window for current pace
- **`storage.ts`** — IndexedDB backup every 10s
- **`wake-lock.ts`** — Prevents screen sleep
- **`demo-data.ts`** — Golden Gate Park 5K loop (350 points)

### Pages (`src/app/`)
- **`/`** — Home. Auth-aware: shows profile link or login button.
- **`/auth/login`** — Magic link login.
- **`/profile`** — Profile setup/edit. Onboarding mode for new users.
- **`/setup`** — Pre-run config. Pre-fills from user preferences.
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

### State
- **All durations in seconds, distances in meters** internally. Convert only at display layer.
- **GPS coordinates: [lat, lng]**. Mapbox uses [lng, lat]. Convert at the Mapbox boundary.
- **Zustand stores are ephemeral** — lost on refresh. Only IndexedDB persists GPS/run state.
- **CoachingStore resets on run end** — history is per-session only.

### API Routes
- **All 3 routes are edge runtime** — no Node.js APIs, no fs, no process (except env vars).
- **API keys stay server-side** — never send Anthropic/ElevenLabs keys to the client. The `/api/*` routes exist specifically for this.
- **Streaming responses**: `/api/coach` and `/api/tts` both stream. Don't buffer full responses.

### Testing
- **197 tests** across 17 test files. All must pass before pushing.
- **Ask before deleting any tests.** User's explicit standing instruction.
- Run: `npx vitest run`
- Build: `npx next build`
- Both must pass before any push to main.

## Coaching System Details

### 4 Personas
| Persona | Style | ElevenLabs Voice | Speed |
|---------|-------|-----------------|-------|
| Hype | Energetic, exclamations, celebrates | `pNInz6obpgDQGcFmaJgB` | 1.1x |
| Calm | Mindful, breathing focus, grounding | `EXAVITQu4vr4xnSDxMaL` | 0.9x |
| Data | Analytical, stats-driven, strategic | `21m00Tcm4TlvDq8ikWAM` | 1.0x |
| Storyteller | Narratives, cliffhangers, topic-based | `yoZ06aMxZJJ28mfd3POQ` | 0.95x |

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
- **Motivation Engine (rule-based)** — detects struggle/flow, picks energy approach
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
- **No offline coaching**: Claude + ElevenLabs require internet. GPS tracking works offline (IndexedDB), but coaching goes silent. Completed runs are queued and synced on next app load.
- **Global agents need scheduler**: Race Director and Story Library Edge Functions need an external cron scheduler (pg_cron or Vercel cron). Not auto-scheduled yet.
- **Opus 4.6 cost**: Head Coach + Story Curator + Quality Supervisor use Opus 4.6. Estimated ~$0.17 per 30-min run. Monitor usage.

## Dev / Demo Modes

- **Dev mode**: `/dev` → enter password `claude` → `/run?dev=true`. Runs SF Marathon 2026 route simulation at configurable speed (10x-50x). Full coaching pipeline active.
- **Demo mode**: `/run?demo=true`. Replays Golden Gate Park 5K at 10x speed. Good for quick tests.
- Both modes generate 200+ synthetic runners for collective presence.

## Environment Variables

```
ANTHROPIC_API_KEY          — Claude API (server-side only)
ELEVENLABS_API_KEY         — ElevenLabs TTS (server-side only)
NEXT_PUBLIC_MAPBOX_TOKEN   — Mapbox GL JS (client-side)
NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon key
SUPABASE_SERVICE_ROLE_KEY  — Supabase admin (server-side only)
OPENWEATHER_API_KEY        — Weather data (unused currently)
```

## Past Bugs & Fixes (Learn From These)

1. **Overlapping audio** (fixed in `c1ee8b9`): `processQueue` in AudioManager had a race condition — `onComplete` could start a second concurrent sentence-processing loop. Fixed with `isProcessing` lock + `interrupted` flag + `interrupt()` method.

2. **Short stories** (fixed in `8cbb0a4`): `max_tokens: 150` was hardcoded for all triggers. Stories need 400 tokens. Made dynamic based on trigger type.

3. **Repeated stories** (fixed in `cf3a844`): Every Claude call was stateless — no memory of previous messages. Added CoachingStore + PREVIOUS COACHING prompt section + cliffhanger continuation.

4. **onComplete returned empty string** (fixed in `cf3a844`): `coach-client.ts` passed the sliced `fullText` remainder to `onComplete` instead of the full response. Added separate `collectedFullText` accumulator.
