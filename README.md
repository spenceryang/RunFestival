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

### AI Voice Coaching
- 4 coaching personas with distinct voices and personalities
- Context-aware triggers: split completion, pace drift, halfway, final push, idle storytelling
- Sentence-level streaming for <5s latency (Claude API to ElevenLabs TTS to Web Audio)
- Mid-run voice input via Web Speech API

### GPS Run Tracking
- Real-time pace, distance, and elapsed time
- 30-second rolling window pace smoothing (no GPS jitter)
- Auto-splits every 1km with pace comparison
- Offline-capable with IndexedDB backup
- Wake Lock keeps your screen on

### Community Presence
- Live runner count via Supabase Realtime
- Milestone feed from other runners worldwide
- Community run timeline

### Post-Run Recap
- AI-generated narrative analyzing your pace, splits, and patterns
- Mapbox pace heatmap (green = fast, orange = on pace, red = slow)
- Split table with target pace comparison

### Dev / Demo Mode
- Demo mode: simulated 5K at 10x speed
- Dev mode: password-protected SF Marathon 2026 route simulation with adjustable speed (5x/10x/20x/50x) and GPS debug panel

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
| State | Zustand |
| Backend | Supabase (Auth, PostgreSQL, Realtime) |
| AI | Claude API (Sonnet 4.5, streaming) |
| TTS | ElevenLabs (Turbo v2.5, streaming) |
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
| `ELEVENLABS_API_KEY` | ElevenLabs API key for voice | Yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token for maps | Yes |
| `OPENWEATHER_API_KEY` | OpenWeather API key | Optional |

### Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run test         # Run all tests (144 tests)
npm run test:watch   # Watch mode
```

## Architecture

```
src/
  app/
    api/coach/       # Claude streaming proxy (Edge Runtime)
    api/tts/         # ElevenLabs streaming proxy (Edge Runtime)
    api/recap/       # AI run recap generation (Edge Runtime)
    run/             # Run screen (GPS + coaching)
    setup/           # Pre-run config (distance, pace, persona)
    recap/           # Post-run summary + map
    dev/             # Dev mode gate
    community/       # Community timeline
  components/
    run/             # RunScreen, DemoRunScreen, DevRunScreen
    recap/           # RecapMap, RecapNarrative, stats
    shared/          # CommunityTimeline
  lib/
    gps/             # Tracker, distance/pace math, demo routes
    coach/           # Trigger engine, context builder, prompts
    audio/           # TTS client, audio manager, voice input
    store/           # Zustand stores (run, collective, timeline)
    supabase/        # Client + server instances
    collective/      # Presence, synthetic runners
  types/             # TypeScript interfaces
```

## How It Works

1. **Setup** — Choose distance, target pace, and coaching persona
2. **Run** — GPS tracking starts; coaching triggers evaluate every 3 seconds
3. **Coach** — Trigger fires, context assembled, streamed to Claude, then sentence-by-sentence to ElevenLabs TTS, played via Web Audio API
4. **Community** — Supabase Realtime broadcasts your presence; you see others running
5. **Recap** — AI narrative, pace heatmap on Mapbox, split-by-split analysis

## Documentation

- [PRD.md](docs/PRD.md) — Product requirements
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture and data flows
- [PROMPTS.md](docs/PROMPTS.md) — Coaching persona system prompts

## License

MIT
