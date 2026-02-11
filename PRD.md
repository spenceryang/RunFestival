# RunFestival — Product Requirements Document

## Vision

**RunFestival** turns every solo run into a shared experience. Open the app, hit go, and you're immediately running with hundreds of people worldwide. Your AI coach knows your pace, your goals, your route — and it knows who else is out there right now.

**Tagline:** You run alone. You never run alone.

**Track:** Amplify Human Judgment — Your AI coach amplifies your running decisions without replacing your autonomy. You decide pace, route, effort. The coach ensures you have the information and motivation to decide well.

---

## Problem Statement

Running is the world's most accessible sport, but it has a loneliness problem:

- **During the run**, you're alone with your thoughts and a pace number on screen
- **Strava** is great *after* the run (tracking, social, stats) but offers nothing *during*
- **Peloton/SoulCycle** proved people pay $40/month to not exercise alone — but only works indoors
- **Run clubs** have time/location constraints that exclude most runners
- Runners already wear earbuds and listen to *something* — that something could be dramatically better

## Target User

Primary: Solo runners who run 2-5x per week, own wireless earbuds, and want motivation/community but can't commit to a run club schedule.

Secondary: New runners who need coaching and accountability to build the habit.

---

## Core Product Principles

1. **Never autopilot the run.** Present choices, don't make them. "You're ahead of pace — bank it or ease off?" is correct. "Slowing you down now" is wrong.
2. **The voice is the product.** If the audio experience doesn't give you chills, nothing else matters.
3. **Community is ambient, not demanding.** You feel the collective without being forced to interact. No mandatory social features.
4. **Works on day one, magical on day 100.** First run should be great even with zero history. Gets better as it learns your patterns.

---

## Feature Specifications

### F1: Run Tracking Core

**Priority: P0 (must have)**

The foundation — GPS-based run tracking that feeds all other features.

**Requirements:**
- Real-time GPS tracking via browser Geolocation API (high accuracy mode)
- Calculate and display: current pace, average pace, distance, elapsed time, current speed
- Pace smoothing via rolling average (last 30 seconds) to avoid GPS jitter
- Mile/km split tracking with automatic split announcements
- Run state machine: IDLE → READY → RUNNING → PAUSED → FINISHED
- Background tracking when screen is locked (via Wake Lock API)
- Store run data locally (IndexedDB) as backup, sync to Supabase when connected

**Data model per GPS point:**
```
{
  lat: number,
  lng: number,
  altitude: number | null,
  speed: number | null,      // m/s from GPS
  timestamp: number,         // Unix ms
  accuracy: number           // meters
}
```

**Derived metrics (recalculated every 3 seconds):**
```
{
  distance_meters: number,
  elapsed_seconds: number,
  current_pace_per_km: number,   // seconds
  average_pace_per_km: number,
  current_split: number,         // which km/mile
  split_times: number[],         // pace for each completed split
}
```

### F2: AI Voice Coach

**Priority: P0 (must have)**

The core differentiator — a real-time AI voice companion that coaches, motivates, and entertains.

**Requirements:**

**Coaching triggers (event-driven, not continuous):**
- **Mile/km markers:** Announce split time, compare to target, give encouragement
- **Pace drift:** If pace deviates >15% from target for >60 seconds, intervene
- **Halfway point:** "You're halfway. Here's how you're doing."
- **Final push:** Last 10% of planned distance, shift to motivation mode
- **Idle periods:** If no trigger for >3 minutes during steady running, offer story/content
- **User-initiated:** Tap button or voice command to talk to coach

**Coaching personas (user selects pre-run):**
- **Hype Coach:** High energy, Peloton instructor vibes, lots of "LET'S GO"
- **Calm Guide:** Measured, zen, focuses on breathing and mindfulness
- **Data Nerd:** All about the splits, pacing strategy, optimization
- **Storyteller:** Tells fascinating stories, keeps your mind off the miles

**System prompt structure:**
```
You are a running coach on RunFestival. Your persona is {persona}.

CURRENT RUN STATE:
- Distance: {distance}km of {target}km
- Current pace: {pace}/km (target: {target_pace}/km)
- Elapsed: {elapsed}
- Current split ({split_num}): {split_pace}/km
- Previous splits: {splits}
- Heart rate zone estimate: {zone} (based on pace)
- Weather: {weather}
- Route: {route_description}

LIVE COLLECTIVE:
- {runner_count} people running right now
- Notable events: {recent_events}

RUNNER PROFILE:
- Name: {name}
- Goal: {goal}
- Experience level: {level}
- Preferred topics for stories: {topics}
- Run history summary: {history}

RULES:
- Keep responses to 2-3 sentences (will be spoken aloud)
- Never tell the runner what to do — present options and let them decide
- Match energy to the moment (hype for milestones, calm for steady state)
- Reference the collective naturally ("you and 300 others are crushing it")
- If in storytelling mode, tell engaging stories from their chosen topics
- Use their name occasionally but not every message
```

**Voice pipeline:**
1. Coaching trigger fires
2. Compose context payload (run state + profile + collective)
3. Send to Claude API (streaming)
4. Stream text chunks to ElevenLabs TTS API
5. Queue audio chunks for seamless playback
6. Do not interrupt currently playing audio — queue next message

**Voice selection:**
- Default: ElevenLabs pre-made voices (select by persona)
- Stretch: User can clone their own voice or pick from a library

**Fallback:** If ElevenLabs is unavailable, use browser SpeechSynthesis API

### F3: Live Collective (The Peloton Layer)

**Priority: P0 (must have)**

The emotional core — making solo runners feel part of something bigger.

**Requirements:**

**Presence system:**
- When a user starts a run, register presence in Supabase Realtime
- Track: user_id, city, start_time, current_distance, current_pace
- Deregister on run end or disconnect
- Display live count: "342 people running with you right now"

**Event broadcasts:**
- Milestone events: "{name} in {city} just finished their first 10K!"
- Collective stats: "Together, RunFestival runners have covered 1,847km today"
- Hype moments: When runner count crosses a threshold, coach gets excited
- Group pace: "The collective average pace right now is 5:42/km"

**Privacy controls:**
- Users can choose: share city + first name, share city only, or fully anonymous
- Default: city + first name
- Never share exact location or route

**Implementation:**
- Supabase Realtime channels for presence
- Edge function to aggregate stats every 30 seconds
- Coach receives collective data as part of context injection

**For hackathon demo:**
- Seed with 200-500 synthetic runners across global cities
- Synthetic runners have realistic pace curves and start/stop times
- Any real hackathon attendees who join appear alongside synthetic data

### F4: Smart Routes

**Priority: P1 (should have)**

Route suggestions based on goals, with real-time navigation.

**Requirements:**

**Pre-run route generation:**
- User inputs: distance goal, preference (flat/hilly/scenic), start location
- Mapbox Directions API generates route options
- Show elevation profile for each option
- Estimate pace adjustment for elevation

**Mid-run navigation:**
- Turn-by-turn voice directions blended with coaching
- "In 200 meters, turn left onto Oak Street — great downhill section coming up"
- Re-route if runner goes off-path

**Post-run map:**
- Show completed route on map with pace heatmap (color by speed)
- Split markers on map
- Elevation overlay

### F5: Pre-Run Setup

**Priority: P0 (must have)**

Quick, frictionless setup before each run.

**Requirements:**
- Distance goal (or "just run" with no target)
- Target pace (or "no target")
- Coaching persona selection
- Optional: route preference
- "Quick start" — one tap with last-used settings
- Setup should take <15 seconds for returning users

### F6: Post-Run Recap

**Priority: P1 (should have)**

AI-generated run summary.

**Requirements:**
- Map with route
- Splits table
- AI narrative summary: "You started strong, held steady through miles 2-4, and kicked it up for the finish. Your 5K split was a new personal best."
- Collective context: "You ran with 287 people today. The group covered 4,200km together."
- Shareable card (image) for social media

### F7: User Profiles & History

**Priority: P1 (should have)**

**Requirements:**
- Basic auth (Supabase Auth — email/password or Google OAuth)
- Profile: name, city, experience level, goals, preferred persona, story topics
- Run history: list of past runs with summaries
- Streak tracking: consecutive days/weeks of running
- Coach memory: AI references past runs ("last Tuesday you crushed that hill")

---

## Non-Functional Requirements

### Performance
- GPS update frequency: every 3 seconds
- Coach response latency: <5 seconds from trigger to audio start
- App must work reliably in background (screen locked)
- Offline resilience: run tracking works without internet, sync later

### Mobile Web (PWA)
- Must work as PWA on iOS Safari and Android Chrome
- Add to Home Screen support
- Wake Lock API for screen-on during runs
- Service worker for offline capability

### Audio
- Audio must play reliably over Bluetooth earbuds
- Must not interfere with background music (mix, don't replace)
- Volume normalization across TTS outputs

---

## Pages / Screens

### 1. Landing / Onboarding
- Value prop, sign up / sign in
- First-time setup: name, city, experience, goals, persona preference

### 2. Home (Pre-Run)
- Quick start button (prominent)
- Today's suggestion: "Perfect day for a 5K — 62°F and sunny"
- Last run summary card
- Live runner count ("187 people running right now")
- Streak indicator

### 3. Run Setup
- Distance goal slider/input
- Target pace (optional)
- Persona selector (4 options with preview)
- Route selector (if F4 is built)
- GO button

### 4. Active Run Screen
- Large current pace display
- Distance and elapsed time
- Live runner count (subtle, top bar)
- Map with current position (toggleable, default hidden to save battery)
- Pause / Stop buttons
- "Talk to coach" button
- Minimal UI — the voice is the interface

### 5. Post-Run Recap
- Route map with pace heatmap
- Splits table
- AI narrative summary
- Collective stats
- Share button (generates image card)
- Save run

### 6. Profile / History
- Run history list
- Stats: total distance, streak, avg pace trend
- Settings: persona, voice, privacy, units (km/mi)

---

## Data Model (Supabase)

### Tables

```sql
-- Users
users (
  id uuid PRIMARY KEY,
  email text,
  name text,
  city text,
  experience_level text,  -- 'beginner' | 'intermediate' | 'advanced'
  preferred_persona text,  -- 'hype' | 'calm' | 'data' | 'storyteller'
  story_topics text[],
  distance_unit text DEFAULT 'km',  -- 'km' | 'mi'
  privacy_level text DEFAULT 'city_name',  -- 'city_name' | 'city_only' | 'anonymous'
  created_at timestamptz
)

-- Runs
runs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  started_at timestamptz,
  finished_at timestamptz,
  distance_meters float,
  elapsed_seconds int,
  average_pace float,          -- seconds per km
  splits jsonb,                -- [{distance_m, pace, elapsed_s}]
  gps_points jsonb,            -- [{lat, lng, alt, speed, ts, accuracy}]
  route_geojson jsonb,         -- simplified route line
  persona_used text,
  ai_summary text,             -- post-run narrative
  collective_count int,        -- how many were running during this run
  weather jsonb,
  created_at timestamptz
)

-- Active Runners (ephemeral — cleared on disconnect)
active_runners (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  display_name text,
  city text,
  started_at timestamptz,
  current_distance_meters float,
  current_pace float,
  last_heartbeat timestamptz
)

-- Collective Events (broadcast feed)
collective_events (
  id uuid PRIMARY KEY,
  event_type text,   -- 'milestone' | 'collective_stat' | 'hype_moment'
  payload jsonb,     -- {user_name, city, achievement, stat_value, etc}
  created_at timestamptz
)
```

### Realtime Channels

```
channel: 'active_runners'
  - presence: track who's running
  - broadcast: milestone events

channel: 'collective_stats'
  - broadcast: aggregated stats every 30s
```

---

## API Endpoints (Supabase Edge Functions)

```
POST /functions/v1/start-run
  → Register active runner, return run_id

POST /functions/v1/heartbeat
  → Update active runner position/pace (called every 30s)

POST /functions/v1/end-run
  → Deregister active runner, save run data, generate AI summary

POST /functions/v1/coach-message
  → Send run context to Claude, return coaching text
  → Body: { run_state, profile, collective_data, trigger_type }

GET  /functions/v1/collective-stats
  → Return current runner count, aggregate stats

POST /functions/v1/generate-recap
  → Generate post-run AI narrative and shareable image
```

---

## Third-Party Services

| Service | Purpose | Tier |
|---------|---------|------|
| **Supabase** | Auth, DB, Realtime, Edge Functions, Storage | Free tier |
| **Claude API** | Coaching intelligence | Pay-per-use |
| **ElevenLabs** | Text-to-speech | Free tier (10k chars/mo) → paid if needed |
| **Mapbox** | Maps, Directions, Geocoding | Free tier (50k loads/mo) |
| **Vercel** | Hosting, CDN | Free tier |
| **OpenWeather** | Weather data for context | Free tier |

---

## Success Criteria (Hackathon)

### Must Demo
1. Start a run → see live pace/distance tracking
2. Hear AI coach respond to a pace change with spoken audio
3. See live runner count and hear coach reference the collective
4. Complete a run and see AI-generated recap

### Should Demo
5. Route suggestion with elevation profile
6. Different coaching personas (play audio clips of each)
7. Post-run shareable card

### Nice to Demo
8. Real hackathon attendees joining as live runners
9. Voice input ("tell me a story about this neighborhood")
10. Strava sync
