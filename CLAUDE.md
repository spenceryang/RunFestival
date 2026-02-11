# CLAUDE.md — RunFestival

## Project Overview

RunFestival is a Progressive Web App that turns solo runs into shared experiences with real-time AI voice coaching and live community presence. Built for the Claude Code Hackathon (Track: Amplify Human Judgment).

**Core insight:** Strava is great after the run. RunFestival is great *during* the run.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Edge Functions, Storage)
- **AI:** Claude API (Sonnet 4.5 for coaching, streaming)
- **TTS:** ElevenLabs API (streaming text-to-speech)
- **Maps:** Mapbox GL JS + Directions API
- **Deploy:** Vercel

## Key Files

- `docs/PRD.md` — Full product requirements
- `docs/ARCHITECTURE.md` — System architecture, data flow, subsystems
- `docs/PROMPTS.md` — All Claude system prompts for coaching personas

## Build Priorities

Build in this exact order. Each step should be independently testable.

### Phase 1: Run Tracking (Day 1)
1. Scaffold Next.js app with Tailwind, Zustand, Supabase client
2. Implement GPS tracker (`src/lib/gps/tracker.ts`) using Geolocation API
3. Build distance calculator (Haversine) and pace calculator (30s rolling avg)
4. Create run state machine: IDLE → SETUP → RUNNING → PAUSED → FINISHED
5. Build minimal Run Screen UI: big pace number, distance, time, start/stop buttons
6. Add Wake Lock API to prevent screen sleep
7. Store GPS points in IndexedDB as backup

### Phase 2: Voice Pipeline (Day 2-3)
1. Build coaching trigger engine (`src/lib/coach/trigger-engine.ts`)
   - Split complete, pace drift, halfway, final push, idle
2. Build context assembler that packages run state for Claude
3. Create API route (`src/app/api/coach/route.ts`) that streams Claude responses
4. Build ElevenLabs TTS client (`src/lib/audio/tts-client.ts`) with streaming
5. Build audio manager with playback queue (Web Audio API)
6. Wire up: trigger → context → Claude stream → TTS stream → audio play
7. Add browser SpeechSynthesis fallback
8. Implement coaching personas (system prompts in `docs/PROMPTS.md`)

### Phase 3: Collective Presence (Day 4)
1. Set up Supabase Realtime channel for runner presence
2. Register/deregister runners on start/end
3. Heartbeat updates every 30 seconds
4. Live runner count component
5. Milestone event broadcasting
6. Feed collective data into coaching context
7. Build synthetic runner seeder for demo

### Phase 4: Routes & Polish (Day 5)
1. Mapbox GL JS map integration
2. Route generation (circular routes via Directions API)
3. Elevation profiles
4. Pre-run setup screen (distance, pace, persona)
5. Post-run recap screen (map, splits, AI summary)

### Phase 5: Demo Prep (Day 6-7)
1. Demo mode with simulated GPS data (replay a real run at 10x speed)
2. Polish UI — the run screen should feel like a premium product
3. Record audio clips of coaching sessions for presentation
4. Onboarding flow
5. Bug fixes and edge cases

## Code Conventions

- TypeScript strict mode
- Use `async/await` over `.then()` chains
- Zustand stores in `src/lib/store/` — one per domain
- API routes handle errors gracefully — never crash the run
- All durations internally in seconds, distances in meters
- Convert to user-preferred units (km/mi) only at display layer
- GPS coordinates always [lat, lng] (not [lng, lat] — be careful with Mapbox which uses [lng, lat])
- Audio errors should never surface to user — fall back silently

## Critical Implementation Notes

### GPS Tracking
- Use `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`
- Filter points with `accuracy > 30` meters
- Calculate pace with 30-second rolling window to smooth GPS jitter
- Store raw GPS buffer in IndexedDB — sync to Supabase on run end
- The Geolocation API uses [lat, lng] but Mapbox uses [lng, lat] — convert carefully

### Voice Pipeline (MOST IMPORTANT)
- Latency is everything. Target <5 seconds from trigger to first audio
- Stream Claude response, send first complete sentence to TTS immediately
- Stream TTS audio, start playback as soon as first chunk arrives
- Never interrupt currently playing audio — queue next message
- Max queue size: 2 messages (drop oldest if full)
- Minimum interval between coaching messages: 45 seconds
- The proxy endpoints (`/api/coach` and `/api/tts`) exist to keep API keys server-side

### ElevenLabs Integration
- Use `eleven_turbo_v2_5` model for lowest latency
- Output format: `mp3_44100_64` (good balance of quality vs size)
- Stream the response — don't wait for full audio
- Voice IDs are in `docs/PROMPTS.md`
- Free tier: 10,000 characters/month — cache common phrases if needed

### Collective Presence
- Use Supabase Realtime presence (not regular subscriptions)
- Presence is ephemeral — automatically cleaned up on disconnect
- Heartbeat every 30 seconds with updated distance/pace
- For hackathon demo: seed 200-500 synthetic runners via edge function
- Privacy: never share exact GPS coordinates, only city-level

### Maps (Mapbox)
- Use `mapbox-gl` npm package, NOT react-map-gl (too heavy for PWA)
- Remember: Mapbox uses [lng, lat] order, Geolocation uses [lat, lng]
- For route generation: create circular waypoints, request route through them
- During run: update runner marker position every 3 seconds
- After run: show route with pace heatmap (color-coded by speed)

### PWA
- Use `next-pwa` for service worker generation
- Manifest needs: name, icons (192x192, 512x512), theme_color, display: standalone
- The app MUST work with screen locked (Wake Lock API)
- Audio playback must continue in background

## Common Pitfalls

1. **Don't use `setInterval` for GPS** — use `watchPosition` which fires on position change
2. **Don't block on TTS** — stream it. Waiting for full audio kills the experience
3. **Don't send coaching messages too frequently** — 45s minimum interval
4. **Don't display raw GPS pace** — it's noisy. Always smooth it
5. **Don't forget coordinate order** — Geolocation = [lat, lng], Mapbox = [lng, lat]
6. **Don't make the coach talk during user's music** — provide a mute/pause option
7. **Don't require internet for run tracking** — GPS + IndexedDB should work offline

## Testing

- Test GPS tracking by walking around (don't need to run)
- Test voice pipeline with mock run data (static pace, simulated triggers)
- Test collective with 2 browser tabs both starting runs
- Demo mode: replay recorded GPS data at accelerated speed

## Environment Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in API keys
npm run dev
```

Required API keys:
- Supabase (URL + anon key + service role key)
- Anthropic (Claude API key)
- ElevenLabs (API key)
- Mapbox (public token)
- OpenWeather (API key)
