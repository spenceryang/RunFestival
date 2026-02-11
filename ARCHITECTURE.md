# RunFestival — Technical Architecture

## System Overview

RunFestival is a Progressive Web App (PWA) built with Next.js that provides real-time AI voice coaching during runs. The system has four core subsystems: Run Tracking, Voice Pipeline, Collective Presence, and Route Intelligence.

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                              │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ GPS Tracker  │  │  Audio Engine │  │    Run UI (React)      │  │
│  │ (Geolocation │→ │  (Web Audio   │  │  - Active Run Screen   │  │
│  │  API)        │  │   API)        │  │  - Setup / Recap       │  │
│  └──────┬───────┘  └──────▲───────┘  └────────────────────────┘  │
│         │                 │                                      │
│  ┌──────▼─────────────────┴───────────────────────────────────┐  │
│  │              Coaching Engine (Client-side)                  │  │
│  │  - Trigger detection (pace drift, milestones, idle)        │  │
│  │  - Context assembly (run state + profile + collective)     │  │
│  │  - Message queue (don't interrupt current audio)           │  │
│  └──────┬─────────────────────────────────────────────────────┘  │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                            │
│                                                                  │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Supabase        │  │  Claude API     │  │  ElevenLabs      │  │
│  │  - Auth          │  │  (Streaming)    │  │  TTS API         │  │
│  │  - PostgreSQL    │  │                 │  │  (Streaming)     │  │
│  │  - Realtime      │  │  POST /messages │  │                  │  │
│  │  - Edge Fns      │  │  with stream    │  │  POST /text-to-  │  │
│  │  - Storage       │  │                 │  │  speech/stream   │  │
│  └─────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌────────────────┐                        │
│  │  Mapbox          │  │  OpenWeather    │                        │
│  │  - Maps GL JS    │  │  - Current      │                        │
│  │  - Directions    │  │    weather      │                        │
│  │  - Geocoding     │  │                 │                        │
│  └─────────────────┘  └────────────────┘                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Subsystem 1: Run Tracking

### GPS Pipeline

```
Geolocation API (watchPosition)
  │  frequency: every 3 seconds
  │  enableHighAccuracy: true
  │  maximumAge: 0
  │
  ▼
GPS Filter
  │  - Discard points with accuracy > 30m
  │  - Kalman filter for smoothing (optional, stretch)
  │
  ▼
Distance Calculator
  │  - Haversine formula between consecutive points
  │  - Accumulate total distance
  │
  ▼
Pace Calculator
  │  - Rolling 30-second window average
  │  - Per-split pace (reset at each km/mi boundary)
  │  - Overall average pace
  │
  ▼
State Store (Zustand)
  │  - All run metrics available to UI + Coaching Engine
  │
  ├──▶ UI Update (React re-render)
  ├──▶ Coaching Engine (trigger evaluation)
  ├──▶ IndexedDB (local backup every 10s)
  └──▶ Supabase heartbeat (every 30s)
```

### Run State Machine

```
       ┌──────┐
       │ IDLE │ ← user on home screen
       └──┬───┘
          │ user taps "Setup Run"
          ▼
       ┌──────┐
       │SETUP │ ← configuring distance, pace, persona
       └──┬───┘
          │ user taps "GO"
          ▼
      ┌────────┐
      │RUNNING │ ← GPS tracking, coaching active
      └──┬──┬──┘
         │  │ user taps pause
         │  ▼
         │ ┌────────┐
         │ │PAUSED  │ ← GPS paused, timer paused
         │ └──┬──┬──┘
         │    │  │ user taps resume
         │    │  └──▶ RUNNING
         │    │ user taps stop
         │    ▼
         │ ┌────────┐
         └▶│FINISHED│ ← save run, generate recap
           └────────┘
```

### Key Implementation Details

**Wake Lock API** — Prevent screen sleep during runs:
```javascript
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.log('Wake Lock not supported');
  }
}
```

**Haversine Distance Calculation:**
```javascript
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Local persistence** — IndexedDB via idb-keyval for offline resilience:
```javascript
// Save GPS buffer every 10 seconds
// On reconnect, sync to Supabase
// Never lose run data even if connection drops
```

---

## Subsystem 2: Voice Pipeline

This is the most critical subsystem. Latency goal: **<5 seconds from trigger to first audio.**

### Pipeline Flow

```
Coaching Trigger
  │
  ▼
Context Assembler
  │  Builds payload:
  │  - run_state (pace, distance, splits, etc)
  │  - runner_profile (name, goals, persona, history)
  │  - collective_data (runner count, recent events)
  │  - trigger_type (milestone, pace_drift, idle, user_initiated)
  │
  ▼
Message Queue Check
  │  Is audio currently playing?
  │  YES → queue this request (max queue: 2, drop oldest)
  │  NO  → proceed immediately
  │
  ▼
Claude API (Streaming)
  │  POST /v1/messages
  │  model: claude-sonnet-4-5-20250929
  │  stream: true
  │  system: coaching prompt with full context
  │  
  │  Collect text chunks as they stream
  │  When first sentence is complete → send to TTS immediately
  │  Continue collecting for subsequent sentences
  │
  ▼
ElevenLabs TTS (Streaming)
  │  POST /v1/text-to-speech/{voice_id}/stream
  │  model: eleven_turbo_v2_5
  │  output_format: mp3_44100_64
  │  
  │  Stream audio chunks as they arrive
  │
  ▼
Audio Playback (Web Audio API)
  │  Create AudioBuffer from chunks
  │  Schedule seamless playback
  │  Manage volume (don't compete with music)
  │
  ▼
Done → check queue for next message
```

### Latency Budget

```
Trigger detection:     ~0ms   (client-side)
Context assembly:      ~10ms  (client-side)
Claude API (TTFB):     ~800ms (streaming, first token)
Claude API (sentence): ~1.5s  (first complete sentence)
ElevenLabs (TTFB):     ~500ms (streaming)
Audio decode + play:   ~100ms
─────────────────────────────────
Total to first audio:  ~3-4 seconds ✓
```

### Coaching Trigger Engine

```javascript
// Runs every 3 seconds (on each GPS update)

class CoachingTriggerEngine {
  constructor() {
    this.lastCoachMessage = 0;     // timestamp
    this.minInterval = 45_000;      // minimum 45s between messages
    this.idleThreshold = 180_000;   // 3 minutes of no coaching
  }

  evaluate(runState, prevRunState) {
    const now = Date.now();
    if (now - this.lastCoachMessage < this.minInterval) return null;

    // Priority 1: Mile/km marker
    if (runState.currentSplit > prevRunState.currentSplit) {
      return { type: 'split_complete', data: runState };
    }

    // Priority 2: Significant pace drift (>15% from target for >60s)
    if (runState.targetPace && this.paceDriftDetected(runState)) {
      return { type: 'pace_drift', data: runState };
    }

    // Priority 3: Halfway point
    if (runState.targetDistance && this.justPassedHalfway(runState, prevRunState)) {
      return { type: 'halfway', data: runState };
    }

    // Priority 4: Final push (last 10% of distance)
    if (runState.targetDistance && this.inFinalPush(runState)) {
      return { type: 'final_push', data: runState };
    }

    // Priority 5: Idle — no coaching for 3+ minutes
    if (now - this.lastCoachMessage > this.idleThreshold) {
      return { type: 'idle_storytelling', data: runState };
    }

    return null;
  }
}
```

### Voice Selection by Persona

```javascript
const PERSONA_VOICES = {
  hype: {
    elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB',  // "Adam" - energetic male
    systemPromptTone: 'High energy, enthusiastic, uses exclamations. Like a Peloton instructor.',
  },
  calm: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',  // "Bella" - soft female
    systemPromptTone: 'Calm, measured, zen-like. Focus on breathing and mindfulness.',
  },
  data: {
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // "Rachel" - clear, professional
    systemPromptTone: 'Analytical, precise. Loves numbers and pacing strategy.',
  },
  storyteller: {
    elevenLabsVoiceId: 'yoZ06aMxZJJ28mfd3POQ', // "Sam" - warm narrator
    systemPromptTone: 'Warm narrator. Tells fascinating stories from chosen topics.',
  },
};
```

### Audio Manager

```javascript
class AudioManager {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.audioContext = new AudioContext();
  }

  async playTTSStream(audioStream) {
    this.isPlaying = true;
    // Decode audio chunks as they arrive
    // Schedule each chunk for gapless playback
    // Use AudioContext.createBufferSource for precise timing
    // On complete, check queue
  }

  enqueue(coachingRequest) {
    if (this.queue.length >= 2) this.queue.shift(); // drop oldest
    this.queue.push(coachingRequest);
    if (!this.isPlaying) this.processNext();
  }
}
```

---

## Subsystem 3: Collective Presence

### Architecture

```
Runner starts run
  │
  ▼
Supabase Realtime: join 'runners' channel
  │  Track presence: { user_id, name, city, started_at }
  │
  ├──▶ Every 30s: heartbeat with current distance/pace
  │
  ├──▶ On milestone: broadcast event to channel
  │     { type: 'milestone', user: 'Sarah', city: 'London', achievement: '10K PR' }
  │
  └──▶ Subscribe to channel events
       - Update local runner count
       - Feed events to Coaching Engine context
       - Coach naturally references: "342 people running with you"
```

### Supabase Realtime Implementation

```javascript
// Join presence channel
const channel = supabase.channel('runners', {
  config: { presence: { key: userId } }
});

// Track own presence
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      user_id: userId,
      display_name: name,
      city: city,
      started_at: new Date().toISOString(),
      distance_meters: 0,
      current_pace: 0,
    });
  }
});

// Listen for presence changes (runner count)
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  const runnerCount = Object.keys(state).length;
  updateCollectiveState({ runnerCount });
});

// Listen for broadcast events (milestones)
channel.on('broadcast', { event: 'milestone' }, ({ payload }) => {
  addCollectiveEvent(payload);
});

// Broadcast own milestones
function broadcastMilestone(achievement) {
  channel.send({
    type: 'broadcast',
    event: 'milestone',
    payload: {
      user: displayName,
      city: city,
      achievement: achievement,
      timestamp: new Date().toISOString(),
    }
  });
}
```

### Synthetic Runner Seeding (Demo Mode)

For the hackathon demo, we seed the system with synthetic runners:

```javascript
// Edge function: seed-synthetic-runners
// Run on a cron or manually before demo

const CITIES = [
  'San Francisco', 'New York', 'London', 'Tokyo', 'Berlin',
  'Sydney', 'Toronto', 'Singapore', 'Paris', 'São Paulo',
  'Austin', 'Portland', 'Chicago',
];

function generateSyntheticRunner() {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const pace = 300 + Math.random() * 180; // 5:00 - 8:00 /km
  const startedMinutesAgo = Math.random() * 45;
  return {
    user_id: `synthetic-${uuid()}`,
    display_name: faker.person.firstName(),
    city,
    current_pace: pace,
    distance_meters: (startedMinutesAgo * 60) / pace * 1000,
    started_at: new Date(Date.now() - startedMinutesAgo * 60000),
  };
}

// Generate 200-500 synthetic runners
// Register them as presence in Supabase Realtime
// Periodically update their stats to simulate progress
// Occasionally broadcast milestones
```

---

## Subsystem 4: Route Intelligence

### Route Generation Flow

```
User inputs:
  - Start: current GPS location
  - Distance: 5km
  - Preference: hilly
  │
  ▼
Mapbox Directions API
  │  Generate circular route from start point
  │  Method: create waypoints at compass points, request route
  │  
  │  For "hilly": select waypoints with elevation changes
  │  For "flat": select waypoints in flat areas
  │  For "scenic": bias toward parks, waterfronts
  │
  ▼
Elevation Profile
  │  Mapbox Tilequery API for elevation at route points
  │  Calculate total ascent/descent
  │  Estimate pace adjustment (+5-10s/km per 100m ascent)
  │
  ▼
Route Display
  │  Mapbox GL JS map with route line
  │  Elevation profile chart below map
  │  Turn-by-turn directions list
  │
  ▼
During Run: Navigation
  │  Compare runner GPS to route
  │  Announce upcoming turns via coach
  │  Detect off-route and suggest return
```

### Circular Route Generation Strategy

```javascript
// Generate a roughly circular route of target distance
function generateRouteWaypoints(startLat, startLng, targetDistanceKm) {
  const numWaypoints = 4;
  const radius = targetDistanceKm / (2 * Math.PI) * 0.8; // rough radius in km
  const waypoints = [];

  for (let i = 0; i < numWaypoints; i++) {
    const angle = (2 * Math.PI * i) / numWaypoints + (Math.random() * 0.3);
    const lat = startLat + (radius / 111) * Math.cos(angle);
    const lng = startLng + (radius / (111 * Math.cos(startLat * Math.PI / 180))) * Math.sin(angle);
    waypoints.push([lng, lat]);
  }

  // Request route through all waypoints returning to start
  return [...waypoints, [startLng, startLat]];
}
```

---

## Project Structure

```
runfestival/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── CLAUDE.md
│   └── PROMPTS.md
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Landing / Home
│   │   ├── setup/
│   │   │   └── page.tsx            # Pre-run setup
│   │   ├── run/
│   │   │   └── page.tsx            # Active run screen
│   │   ├── recap/
│   │   │   └── [id]/page.tsx       # Post-run recap
│   │   ├── profile/
│   │   │   └── page.tsx            # User profile & settings
│   │   └── api/
│   │       ├── coach/route.ts      # Claude coaching endpoint
│   │       ├── tts/route.ts        # ElevenLabs TTS proxy
│   │       └── weather/route.ts    # Weather lookup
│   ├── components/
│   │   ├── run/
│   │   │   ├── RunScreen.tsx       # Main active run UI
│   │   │   ├── PaceDisplay.tsx     # Large pace number
│   │   │   ├── RunControls.tsx     # Start/pause/stop buttons
│   │   │   ├── RunMap.tsx          # Mapbox map during run
│   │   │   └── CollectiveBanner.tsx # "342 running with you"
│   │   ├── setup/
│   │   │   ├── DistanceSelector.tsx
│   │   │   ├── PaceSelector.tsx
│   │   │   └── PersonaSelector.tsx
│   │   ├── recap/
│   │   │   ├── RecapMap.tsx
│   │   │   ├── SplitsTable.tsx
│   │   │   └── AiSummary.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       └── LiveRunnerCount.tsx
│   ├── lib/
│   │   ├── gps/
│   │   │   ├── tracker.ts          # GPS tracking with Geolocation API
│   │   │   ├── distance.ts         # Haversine + distance accumulation
│   │   │   └── pace.ts             # Pace calculation + smoothing
│   │   ├── coach/
│   │   │   ├── trigger-engine.ts   # Coaching trigger detection
│   │   │   ├── context-builder.ts  # Assemble coaching context
│   │   │   ├── coach-client.ts     # Claude API streaming client
│   │   │   └── prompts.ts          # System prompts by persona
│   │   ├── audio/
│   │   │   ├── tts-client.ts       # ElevenLabs streaming client
│   │   │   ├── audio-manager.ts    # Playback queue + Web Audio API
│   │   │   └── fallback-tts.ts     # Browser SpeechSynthesis fallback
│   │   ├── collective/
│   │   │   ├── presence.ts         # Supabase Realtime presence
│   │   │   ├── events.ts           # Milestone broadcasting
│   │   │   └── synthetic.ts        # Demo seed data
│   │   ├── routes/
│   │   │   ├── generator.ts        # Route creation via Mapbox
│   │   │   ├── elevation.ts        # Elevation profile
│   │   │   └── navigation.ts       # Turn-by-turn during run
│   │   ├── store/
│   │   │   ├── run-store.ts        # Zustand: run state
│   │   │   ├── user-store.ts       # Zustand: user profile
│   │   │   └── collective-store.ts # Zustand: collective data
│   │   └── supabase/
│   │       ├── client.ts           # Supabase client init
│   │       ├── auth.ts             # Auth helpers
│   │       └── db.ts               # Database queries
│   ├── styles/
│   │   └── globals.css             # Tailwind + custom styles
│   └── types/
│       ├── run.ts                  # Run-related types
│       ├── coach.ts                # Coaching types
│       └── collective.ts           # Collective types
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Database schema
│   └── functions/
│       ├── start-run/index.ts
│       ├── heartbeat/index.ts
│       ├── end-run/index.ts
│       └── collective-stats/index.ts
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker
│   └── icons/                      # App icons
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local.example
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# OpenWeather
OPENWEATHER_API_KEY=
```

---

## Deployment

### Vercel
- Connect GitHub repo
- Set environment variables
- Auto-deploy on push to `main`

### Supabase
- Create project via Supabase dashboard
- Run migrations: `supabase db push`
- Deploy edge functions: `supabase functions deploy`
- Enable Realtime on `active_runners` table

### PWA
- `next-pwa` plugin for automatic service worker generation
- `manifest.json` with app name, icons, theme color
- Add to Home Screen support on iOS/Android
