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
| State | Zustand (4 stores) | Client-side only, no persistence |
| AI Coaching | Claude Sonnet 4.5 (streaming) | Via `/api/coach` edge route |
| TTS | ElevenLabs `eleven_turbo_v2_5` | Via `/api/tts` edge route |
| Voice Input | Web Speech API | Browser-native, no API key |
| Maps | Mapbox GL JS | [lng, lat] order — Geolocation uses [lat, lng] |
| Presence | Supabase Realtime | Ephemeral presence only, no DB tables |
| GPS Backup | IndexedDB (idb-keyval) | Crash recovery, cleared on run finish |
| Deploy | Vercel (edge runtime) | Auto-deploy on push to main |

## Architecture Overview

```
GPS Tracker ──► RunStore ──► Trigger Engine (every 3s)
                                    │
                                    ▼ fires trigger
                              Context Builder
                           (run state + collective + coaching history)
                                    │
                                    ▼
                              Audio Manager
                           ┌────────┴────────┐
                           │                  │
                    POST /api/coach    POST /api/tts
                    (Claude streaming)  (ElevenLabs per sentence)
                           │                  │
                           ▼                  ▼
                    Sentence parser ──► Web Audio API playback
                           │
                           ▼
                    CoachingStore (track what was said)
```

## File Map

### Stores (`src/lib/store/`)
- **`run-store.ts`** — GPS points, distance, pace, splits, persona, run status
- **`coaching-store.ts`** — Last 8 coaching messages with summaries, topics, cliffhanger tracking
- **`collective-store.ts`** — Live runner count, events, average pace
- **`timeline-store.ts`** — Completed runs feed (all synthetic for now)

### API Routes (`src/app/api/`)
- **`coach/route.ts`** — Proxies to Claude API. Streams SSE. Dynamic max_tokens: 400 for storytelling/user-initiated, 150 for alerts. Injects conversation history into prompt.
- **`tts/route.ts`** — Proxies to ElevenLabs. Streams MP3 audio. Uses persona-specific voice IDs.
- **`recap/route.ts`** — Sends run stats to Claude for post-run narrative. Non-streaming, 200 tokens.

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
- **`/setup`** — Pre-run config (distance, pace, persona)
- **`/run`** — Main run screen (GPS + coaching + voice)
- **`/recap`** — Post-run map, splits, AI narrative
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
- **144 tests** across 11 test files. All must pass before pushing.
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
| `split_complete` | Runner completes 1km | 150 |
| `pace_drift` | >15% off target for 60s | 150 |
| `halfway` | Crosses 50% of target distance | 150 |
| `final_push` | Enters last 10% of distance | 150 |
| `idle_storytelling` | 3+ min without coaching | 400 |
| `user_initiated` | Runner taps mic / speaks | 400 |

### Conversation History
- CoachingStore tracks last 8 messages with summaries + topics + cliffhanger flags
- Injected into Claude prompt as `PREVIOUS COACHING` section
- Prevents story repetition and enables multi-part story continuation
- Helper functions (regex-based, zero latency): `summarizeMessage()`, `extractTopics()`, `detectCliffhanger()`

## Known Limitations

- **TTS is not truly streaming**: `tts-client.ts` calls `response.arrayBuffer()` which buffers the full audio per sentence before playback. True chunk-level streaming would reduce latency further but requires Web Audio API chunk decoding.
- **No user accounts / auth**: No login, no persistent run history. Everything is session-scoped.
- **No offline coaching**: Claude + ElevenLabs require internet. GPS tracking works offline (IndexedDB), but coaching goes silent.
- **Supabase presence only**: No database tables, no stored data. If Supabase is down, app uses synthetic runner data.
- **Profile data is hardcoded**: Runner name, city, story topics are hardcoded in `run/page.tsx`. No profile settings UI yet.

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
