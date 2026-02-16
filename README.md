# RunFestival

**You run alone. You never run alone.**

RunFestival is a Progressive Web App that turns solo runs into shared experiences with real-time AI voice coaching and live community presence. Strava is great *after* the run. RunFestival is great *during* the run.

## What It Does

Open the app, pick your coaching persona, and go. Your AI coach runs with you in real time:

- **Coaches your pace** — announces splits, detects pace drift, adjusts strategy mid-run
- **Talks to you** — tap the mic and speak; your coach responds conversationally with full run context
- **Motivates through community** — "1,247 people running with you right now"
- **Tells stories** — when you're in a groove, it tells fascinating stories from topics you choose
- **Recaps your run** — AI-generated narrative, pace heatmap on a map, split analysis

Think Peloton energy, but for the open road.

## Features

### Multi-Agent AI Coaching
- **Head Coach (Opus 4.6)** — 4 coaching personas with distinct voices and personalities
- **Pace Strategist** — Rule-based split analysis, finish projection, pacing strategy classification
- **Motivation Engine** — Research-backed: 6 run phases, "how" vs "why" mindset modes, momentum detection, self-talk cues, experience-adaptive coaching
- **Story Curator** — Async story planning for idle storytelling triggers
- **Quality Supervisor** — Reviews every 3rd coaching message, improves future prompts
- Sentence-level streaming for <5s latency (Claude API to OpenAI TTS to Web Audio)
- Mid-run voice input via Web Speech API

### Cost Guards & Monitoring
- **TTS Usage Tracker** — Session character limits, rate limiting, per-request size caps
- **Background detection** — Pauses OpenAI TTS API calls when app is backgrounded
- **Server-side guards** — Text length validation on the TTS API route
- **Dev mode analytics panel** — Real-time cost tracking (characters, requests, estimated $)

### User Accounts & Run Persistence
- Magic link authentication — unified login/signup flow (Supabase Auth)
- Profile setup: name, city, experience level, persona, story topics, activity types
- Sign-out from home page dropdown or profile page
- All runs saved to PostgreSQL with splits, GPS route (GeoJSON), coaching messages, AI recap
- Offline sync: failed run completions queued in IndexedDB, synced on next login

### GPS Run Tracking
- Real-time pace, distance, and elapsed time
- 30-second rolling window pace smoothing (no GPS jitter)
- Auto-splits every 1km with pace comparison
- Route persistence as GeoJSON LineString for coach review
- Offline-capable with IndexedDB backup
- Wake Lock keeps your screen on

### Community Presence (Scalable to 10K+)
- City-sharded Supabase Realtime channels (`runners:sf`, `runners:nyc`)
- Global stats aggregation via Edge Function
- Race Director agent detects cross-runner patterns
- Milestone feed from other runners worldwide

### Run Experience UX
- **Coaching activity indicator** — pulsing dot shows when coach is thinking/speaking
- **Stop confirmation** — "Are you sure?" dialog prevents accidental run end
- **Paused state banner** — clear visual when run is paused with resume/stop options
- **Inclusive pace selector** — range up to 10:00/km with encouraging labels, "No target" option

### Post-Run Recap
- **Celebration-first design** — distance achievement hero with confetti animation before stats
- AI-generated narrative analyzing your pace, splits, and patterns
- Mapbox pace heatmap (green = fast, orange = on pace, red = slow)
- Split table with target pace comparison
- Recap persisted alongside run data

### Dev / Demo Mode
- Demo mode: simulated 5K at 10x speed (works without login)
- Dev mode: password-protected SF Marathon 2026 route simulation with adjustable speed
- API usage analytics panel (OpenAI TTS characters, cost, request rate)

## Coaching Personas

| Persona | Vibe | Best For |
|---------|------|----------|
| Hype Coach | Peloton instructor energy | Race day, PRs, motivation |
| Calm Guide | Zen, mindful, grounding | Recovery runs, mindfulness |
| Data Nerd | Analytical, strategic | Training, pacing strategy |
| Storyteller | Fascinating stories | Long runs, easy miles |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript, PWA) |
| Styling | Tailwind CSS |
| State | Zustand (5 stores: run, coaching, collective, timeline, user) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Edge Functions) |
| AI | Claude API (Opus 4.6, streaming) |
| TTS | OpenAI TTS (`tts-1`) with cost guards |
| Voice Input | Web Speech API |
| Maps | Mapbox GL JS |
| Deploy | Vercel (Edge Functions) |

## Getting Started

### Prerequisites

- Node.js 18+
- API keys (see Environment Variables below)

### Setup

```bash
git clone https://github.com/spenceryang/RunFestival.git
cd RunFestival
npm install
cp .env.local.example .env.local
# Fill in your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for AI coaching | Yes |
| `OPENAI_API_KEY` | OpenAI API key for TTS voice | Yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token for maps | Yes |
| `NEXT_PUBLIC_SITE_URL` | Production URL for auth redirects (e.g. `https://runfestival.vercel.app`) | Yes (prod) |
| `OPENWEATHER_API_KEY` | OpenWeather API key | Optional |

### Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run test         # Run all tests (324 tests)
npm run test:watch   # Watch mode
```

## Architecture

```
src/
  app/
    api/coach/       # Claude streaming proxy (Edge Runtime)
    api/tts/         # OpenAI TTS proxy with cost guard (Edge Runtime)
    api/recap/       # AI run recap generation (Edge Runtime)
    api/story-plan/  # Story Curator async planning (Edge Runtime)
    api/quality/     # Quality Supervisor review (Edge Runtime)
    auth/            # Login (magic link) + callback
    run/             # Run screen (GPS + coaching)
    setup/           # Pre-run config (distance, pace, persona)
    recap/           # Post-run summary + map
    profile/         # User profile setup
    dev/             # Dev mode gate
    community/       # Community timeline
  components/
    run/             # RunScreen, DemoRunScreen, DevRunScreen
    recap/           # RecapMap, RecapNarrative, stats
    dev/             # ApiUsagePanel (cost analytics)
    providers/       # AuthProvider
    shared/          # CommunityTimeline
  lib/
    gps/             # Tracker, distance/pace math, demo routes
    coach/           # Trigger engine, context builder, prompts
    audio/           # TTS client, audio manager, voice input, usage tracker
    agents/          # Specialist agents (pace, motivation, story, quality)
    store/           # Zustand stores (run, coaching, collective, timeline, user)
    services/        # Run persistence (with GeoJSON), offline sync
    auth/            # Demo mode headers
    supabase/        # Client, server, edge instances
    collective/      # Presence (city-sharded), synthetic runners
  types/             # TypeScript interfaces
supabase/
  migrations/        # Database schema (PostgreSQL DDL)
  functions/
    race-director/   # Global: cross-runner pattern detection
    story-library/   # Global: daily story seed generation
    aggregate-stats/ # Global: cross-city presence aggregation
```

## How It Works

1. **Sign Up** — Magic link email authentication (or continue in demo mode)
2. **Profile** — Set your name, persona preference, story topics, activity types
3. **Setup** — Choose distance, target pace, and coaching persona (pre-filled from profile)
4. **Run** — GPS tracking starts; 5 agents work together:
   - Trigger engine evaluates every 3s -> Pace Strategist and Motivation Engine enrich context -> Head Coach (Opus 4.6) generates response -> TTS -> Audio playback
   - Story Curator pre-generates story plans (async) for idle triggers
   - Quality Supervisor reviews every 3rd message (async) and feeds improvements back
   - TTS Usage Tracker monitors OpenAI TTS consumption with cost guards
5. **Community** — City-sharded presence channels; Race Director generates cross-runner moments
6. **Recap** — AI narrative, pace heatmap, splits — all persisted to your profile
7. **Offline** — If Supabase is unreachable, run data is queued and synced on next login

### Database Setup

The Supabase schema is in `supabase/migrations/20250210_initial_schema.sql`. To set up:

1. Go to your Supabase Dashboard → SQL Editor
2. Paste the contents of the migration file and run it
3. This creates all tables (users, runs, active_runners, collective_events, story_seeds), indexes, views, triggers, RLS policies, and Realtime subscriptions

Or use the Supabase CLI:
```bash
npx supabase db push
```

## Research

The Motivation Engine is informed by peer-reviewed sports psychology research:

1. **Masters, K. S., Ogles, B. M., & Jolton, J. A. (1993).** "The Development of an Instrument to Measure Motivation for Marathon Running: The Motivations of Marathoners Scales (MOMS)." *Research Quarterly for Exercise and Sport, 64*(2), 134-143. — 11 motivational dimensions; novice vs experienced runner differences.

2. **Touré-Tillery, M. & Fishbach, A. (2025).** "What Motivates Runners: Focusing on the 'How' Rather Than the 'Why'." *Motivation Science.* — When struggling, implemental "how" mindsets (focus on breathing, form, sub-goals) outperform abstract "why" motivation. The core finding behind the engine's mindset mode selection.

3. **Blanchfield, A. W., Hardy, J., De Morree, H. M., Staiano, W., & Marcora, S. M. (2014).** "Talking Yourself Out of Exhaustion: The Effects of Self-Talk on Endurance Performance." *Medicine & Science in Sports & Exercise, 46*(5), 998-1007. — Motivational self-talk significantly increases perceived effort value and fun/interest during endurance tasks.

4. **Nikolaidis, P. T., Chalabaev, A., Rosemann, T., & Knechtle, B. (2019).** "Motivation in the Athens Classic Marathon." *International Journal of Environmental Research and Public Health, 16*(11). — Health, fitness, and social factors drive marathon runners; experience level shifts motivational profiles over time.

## Documentation

- [PRD.md](PRD.md) — Product requirements
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and data flows
- [PROMPTS.md](PROMPTS.md) — Coaching persona system prompts
- [AGENTS.md](docs/AGENTS.md) — Multi-agent architecture details
- [SCALE.md](docs/SCALE.md) — Scaling plan for 10K/100K users with cost projections
- [HARDCODED.md](HARDCODED.md) — Audit of hardcoded values and migration checklist
- [FEATURE_REQUESTS.md](FEATURE_REQUESTS.md) — Planned features: HR zone coaching, treadmill mode, Capacitor native app

## License

MIT
