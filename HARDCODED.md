# HARDCODED.md — RunFestival Configuration Audit

This document logs all hardcoded values in the codebase, their purpose, and whether they should be replaced with environment variables or config constants. Use this as a checklist when moving toward production.

**Last updated:** 2026-02-10
**Total hardcoded values:** 89+

---

## Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Should be env var for production (secrets, pricing, model names) |
| **P1** | Should be a shared config constant (tuning parameters, thresholds) |
| **P2** | Acceptable as-is (physical constants, internal routes, demo data) |

---

## P0 — Environment Variables Needed

These MUST be configurable per deployment (dev/staging/prod).

### API Models & Endpoints

| File | Value | Purpose | Suggested Env Var |
|------|-------|---------|-------------------|
| `src/app/api/coach/route.ts:111` | `'claude-opus-4-6'` | Claude model for coaching | `ANTHROPIC_MODEL` |
| `src/app/api/coach/route.ts:108` | `'2023-06-01'` | Anthropic API version | `ANTHROPIC_API_VERSION` |
| `src/app/api/story-plan/route.ts:79` | `'claude-opus-4-6'` | Claude model (duplicate) | `ANTHROPIC_MODEL` |
| `src/app/api/quality/route.ts:81` | `'claude-opus-4-6'` | Claude model (duplicate) | `ANTHROPIC_MODEL` |
| `src/app/api/tts/route.ts:71` | `'eleven_turbo_v2_5'` | ElevenLabs model | `ELEVENLABS_MODEL` |
| `src/app/api/tts/route.ts:72` | `'mp3_44100_64'` | ElevenLabs output format | `ELEVENLABS_OUTPUT_FORMAT` |

### Token Limits

| File | Value | Purpose | Suggested Env Var |
|------|-------|---------|-------------------|
| `src/app/api/coach/route.ts:49` | `600` | Max tokens (long-form) | `CLAUDE_MAX_TOKENS_LONG` |
| `src/app/api/coach/route.ts:49` | `200` | Max tokens (short-form) | `CLAUDE_MAX_TOKENS_SHORT` |
| `src/app/api/story-plan/route.ts:80` | `400` | Max tokens (story plan) | `CLAUDE_MAX_TOKENS_STORY` |
| `src/app/api/quality/route.ts:82` | `200` | Max tokens (quality review) | `CLAUDE_MAX_TOKENS_QUALITY` |

### TTS Cost Guards

| File | Value | Purpose | Suggested Env Var |
|------|-------|---------|-------------------|
| `src/lib/audio/tts-usage-tracker.ts:19` | `0.30` | ElevenLabs cost per 1K chars | `TTS_COST_PER_1000_CHARS` |
| `src/lib/audio/tts-usage-tracker.ts:22` | `50_000` | Max chars per session | `TTS_MAX_CHARS_PER_SESSION` |
| `src/lib/audio/tts-usage-tracker.ts:23` | `15` | Max requests per minute | `TTS_MAX_REQUESTS_PER_MINUTE` |
| `src/lib/audio/tts-usage-tracker.ts:24` | `1000` | Max chars per request | `TTS_MAX_CHARS_PER_REQUEST` |
| `src/app/api/tts/route.ts:53` | `1000` | Server-side max text length (must match above) | `TTS_MAX_CHARS_PER_REQUEST` |

### Dev Mode

| File | Value | Purpose | Suggested Env Var |
|------|-------|---------|-------------------|
| `src/lib/gps/sf-marathon-route.ts:213` | `'claude'` | Dev mode password | `DEV_MODE_PASSWORD` |

---

## P1 — Config Constants (create `src/lib/config/`)

These control behavior and should be centralized in config files for easy tuning.

### Coaching Thresholds (`config/coaching.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/coach/trigger-engine.ts:16` | `45_000` | Min interval between messages (ms) |
| `src/lib/coach/trigger-engine.ts:17` | `180_000` | Idle threshold before storytelling (ms) |
| `src/lib/coach/trigger-engine.ts:18` | `0.15` | Pace drift threshold (15%) |
| `src/lib/coach/trigger-engine.ts:19` | `60_000` | Pace drift must persist this long (ms) |
| `src/lib/coach/trigger-engine.ts:20` | `0.9` | Final push starts at 90% of distance |
| `src/lib/coach/trigger-engine.ts:95` | `30` | First message after N seconds of running |
| `src/lib/store/coaching-store.ts:32` | `8` | Max coaching history entries |
| `src/lib/audio/audio-manager.ts:8` | `2` | Max audio queue size |
| `src/lib/audio/audio-manager.ts:204` | `0.85` | Audio gain (volume) |
| `src/app/run/page.tsx:202` | `3000` | Trigger evaluation interval (ms) |

### Pace Strategist (`config/coaching.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/agents/pace-strategist.ts:61` | `15` | CV threshold for "erratic" pacing (%) |
| `src/lib/agents/pace-strategist.ts:66` | `-3` | Negative split threshold (%) |
| `src/lib/agents/pace-strategist.ts:68` | `3` | Positive split threshold (%) |
| `src/lib/agents/pace-strategist.ts:82` | `-5` | "Speeding up" trend threshold (%) |
| `src/lib/agents/pace-strategist.ts:83` | `5` | "Slowing down" trend threshold (%) |
| `src/lib/agents/pace-strategist.ts:137` | `5` | Target pace comparison threshold (%) |

### Motivation Engine (`config/coaching.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/agents/motivation-engine.ts:56` | `10` | Struggling: slowing >10% |
| `src/lib/agents/motivation-engine.ts:59` | `-5` | Surging: speeding up >5% |
| `src/lib/agents/motivation-engine.ts:64` | `15` | Struggling: >15% off target |
| `src/lib/agents/motivation-engine.ts:73` | `0.85` | Final stretch at 85% progress |
| `src/lib/agents/motivation-engine.ts:95` | `600` | Early struggle: first 600s (10 min) |
| `src/lib/agents/motivation-engine.ts:102` | `2` | "Locked in" trend threshold (%) |

### GPS (`config/gps.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/gps/pace.ts:4` | `30_000` | Pace rolling window (ms) |
| `src/lib/gps/pace.ts:19` | `30` | Accuracy filter (meters) |
| `src/lib/gps/tracker.ts:9` | `10_000` | GPS timeout (ms) |
| `src/lib/gps/tracker.ts:12` | `30` | Max accuracy threshold (meters) |
| `src/lib/gps/distance.ts:32` | `30` | Accuracy filter (meters) — duplicate |
| `src/lib/store/run-store.ts:44` | `1000` | Split distance (meters) = 1km |

### Voice Config (`config/voices.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/coach/prompts.ts:91` | `'pNInz6obpgDQGcFmaJgB'` | Hype voice ID |
| `src/lib/coach/prompts.ts:98` | `'EXAVITQu4vr4xnSDxMaL'` | Calm voice ID |
| `src/lib/coach/prompts.ts:105` | `'21m00Tcm4TlvDq8ikWAM'` | Data voice ID |
| `src/lib/coach/prompts.ts:112` | `'yoZ06aMxZJJ28mfd3POQ'` | Storyteller voice ID |
| `src/lib/coach/prompts.ts:89-118` | Various floats | Per-persona stability/similarity/style/speed |
| `src/lib/audio/fallback-tts.ts:13-14` | `1.0, 1.0, 0.9` | Browser TTS rate, pitch, volume |

### Presence (`config/presence.ts`)

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/collective/presence.ts:133` | `30_000` | Heartbeat interval (ms) |
| `src/lib/store/collective-store.ts:17` | `10` | Max recent events |
| `src/lib/store/timeline-store.ts:26` | `50` | Max timeline runs |

### Default Topics & Lists

| File | Value | Purpose |
|------|-------|---------|
| `src/lib/agents/story-curator.ts:73` | `['history', 'science', 'nature', 'culture', 'sports']` | Fallback story topics |
| `src/lib/store/user-store.ts:64` | `['history', 'science']` | Default story topics |
| `src/lib/store/user-store.ts:66` | `['running']` | Default activity types |

### Duplicated Data (should be consolidated)

| Files | Value | Action |
|-------|-------|--------|
| `synthetic.ts` + `timeline.ts` | Cities array | Consolidate into `config/synthetic.ts` |
| `synthetic.ts` + `timeline.ts` | Names array | Consolidate into `config/synthetic.ts` |
| Multiple files | Persona list `['hype', 'calm', 'data', 'storyteller']` | Centralize in types |

---

## P2 — Acceptable As-Is

These don't need to change:

| File | Value | Reason |
|------|-------|--------|
| `src/lib/gps/distance.ts:11` | `6371e3` | Earth's radius (physical constant) |
| `src/lib/gps/pace.ts:35` | `1` meter | Min distance for pace calc |
| `src/lib/coach/coach-client.ts:60` | Sentence regex | Language-specific pattern |
| `src/lib/coach/coach-client.ts:16` | `'/api/coach'` | Internal API route |
| `src/lib/agents/story-curator.ts:34` | `'/api/story-plan'` | Internal API route |
| Demo data files | Route params, timing | Demo-only, not production |
| Formatting functions | `60`, `3600` divisors | Math constants |

---

## Migration Checklist

When moving to production:

- [ ] Create `src/lib/config/coaching.ts` with all coaching thresholds
- [ ] Create `src/lib/config/gps.ts` with GPS parameters
- [ ] Create `src/lib/config/voices.ts` with voice IDs & settings
- [ ] Create `src/lib/config/presence.ts` with presence settings
- [ ] Add P0 env vars to `.env.local.example`
- [ ] Consolidate duplicate cities/names arrays
- [ ] Replace all `'claude-opus-4-6'` references with single `ANTHROPIC_MODEL` env var
- [ ] Replace ElevenLabs model/format references with env vars
- [ ] Move dev mode password to `DEV_MODE_PASSWORD` env var
