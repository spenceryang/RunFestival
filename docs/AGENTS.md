# AGENTS.md — RunFestival Multi-Agent Architecture

## Overview

RunFestival uses a multi-agent architecture where each running session is powered by a team of specialized AI agents. The key insight: **agents don't talk to each other in real-time**. They enrich a shared context that the Head Coach consumes. This keeps latency low.

---

## Agent Team Diagram

### Per-User Agent Team (runs during each session)

```
┌─────────────────────────────────────────────────────────────┐
│                   USER'S AGENT TEAM                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              HEAD COACH (Opus 4.6)                      │  │
│  │  - Owns the voice: all output goes through here         │  │
│  │  - Receives enriched context from specialist agents     │  │
│  │  - Makes final creative decision on what to say         │  │
│  │  Triggers: all 6 types                                  │  │
│  │  Tokens: 600 (story/voice) | 200 (alerts)              │  │
│  │  Streaming: yes — sentence-level TTS                    │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────┐  ┌────────┴───────┐  ┌────────────────────┐  │
│  │ PACE        │  │ STORY          │  │ MOTIVATION         │  │
│  │ STRATEGIST  │  │ CURATOR        │  │ ENGINE             │  │
│  │             │  │ (Opus 4.6)     │  │                    │  │
│  │ Rule-based  │  │ Async, cached  │  │ Rule-based         │  │
│  │ Zero cost   │  │ per session    │  │ Zero cost          │  │
│  └────────────┘  └────────────────┘  └────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          QUALITY SUPERVISOR (Opus 4.6)                  │  │
│  │  - Reviews every 3rd coaching message (async)           │  │
│  │  - Score 1-5, feedback, issues list                     │  │
│  │  - Feedback improves future coaching prompts            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Global Agents (cross-user, Supabase Edge Functions)

```
┌─────────────────────────────────────────────────────────────┐
│                     GLOBAL AGENTS                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  RACE DIRECTOR (Opus 4.6)        every 60s             │  │
│  │  - Scans active runners, detects cross-runner patterns  │  │
│  │  - "50 runners crossing 5K right now!"                  │  │
│  │  - Writes to collective_events → Realtime broadcast     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  STORY LIBRARY (Opus 4.6)        daily                  │  │
│  │  - Pre-generates story seeds by topic + activity type   │  │
│  │  - 8 topics x 4 activity types = 32 seeds/day          │  │
│  │  - Stored in story_seeds table for on-demand use        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  AGGREGATE STATS (rule-based)    every 30s              │  │
│  │  - Aggregates presence across city-sharded channels     │  │
│  │  - Publishes global runner count + avg pace             │  │
│  │  - runners:sf + runners:nyc → runners:global            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent Specifications

### 1. Head Coach

| Field | Value |
|-------|-------|
| **File** | `src/app/api/coach/route.ts` |
| **Model** | Claude Opus 4.6 (streaming) |
| **Trigger** | All 6 coaching trigger types |
| **Token limit** | 600 (storytelling/user-initiated), 200 (split/pace/halfway/final_push) |
| **Latency** | 2-4s (on critical path) |
| **Cost/call** | ~$0.015 |

**Reads:**
- RunStore: distance, elapsed, pace, target, splits
- CoachingStore: last 8 messages, topics covered, cliffhanger state, cached story plan, quality reviews
- CollectiveStore: runner count, recent events, avg pace
- UserStore: name, city, experience level, story topics
- PaceAnalysis output (from Pace Strategist)
- MotivationState output (from Motivation Engine)
- StoryPlan (cached from Story Curator)
- Quality feedback string (formatted from Quality Supervisor reviews)

**Produces:**
- Streaming text response (~200-600 tokens)

**Stored in:**
- `CoachingStore.history[]` (session, max 8 entries)
- `Supabase runs.coaching_messages` (persisted on run completion)

**System prompt components:**
- Base prompt (11 critical rules: brevity, non-commanding, energy matching, etc.)
- Persona-specific personality injection (hype/calm/data/storyteller)
- Trigger-specific prompt (e.g., "Continue cliffhanger or start new story")
- PACE ANALYSIS, ENERGY STATE, STORY PLAN, COACHING NOTES sections

---

### 2. Pace Strategist

| Field | Value |
|-------|-------|
| **File** | `src/lib/agents/pace-strategist.ts` |
| **Model** | None (rule-based mathematics) |
| **Trigger** | Synchronous on every coaching trigger |
| **Cost** | $0.00 |

**Reads:**
- RunStore: `splits[]`, `distanceMeters`, `elapsedSeconds`, `targetDistanceMeters`, `targetPaceSecondsPerKm`

**Produces (PaceAnalysis):**
```typescript
{
  strategy: 'even' | 'negative' | 'positive' | 'erratic' | 'insufficient_data',
  advice: string,           // Human-readable coaching suggestion
  projectedFinishSeconds: number | null,
  recentTrend: 'speeding_up' | 'slowing_down' | 'steady',
  splitVariation: number    // Coefficient of variation (%)
}
```

**Stored in:** `CoachingContext.paceAnalysis` (in-memory, per-trigger)

**Logic:**
- Classifies strategy by comparing first/second half average pace (>3% diff)
- Detects trend from last 3 splits (>5% change threshold)
- High variation (>15%) = erratic pacing
- Projects finish: `(elapsed / distance) * targetDistance`

---

### 3. Motivation Engine

| Field | Value |
|-------|-------|
| **File** | `src/lib/agents/motivation-engine.ts` |
| **Model** | None (rule-based classification) |
| **Trigger** | Synchronous on every coaching trigger |
| **Cost** | $0.00 |

**Reads:**
- RunStore: `splits[]`, `currentPaceSecondsPerKm`, `targetPaceSecondsPerKm`, `elapsedSeconds`, `distanceMeters`, `targetDistanceMeters`

**Produces (MotivationState):**
```typescript
{
  energyLevel: 'struggling' | 'steady' | 'surging',
  approach: string,         // Coaching tone guidance
  shouldBoost: boolean,     // True if struggling or in final 15%
  recentPaceTrend: number   // % change (negative = faster)
}
```

**Stored in:** `CoachingContext.motivationState` (in-memory, per-trigger)

**Classification:**
- **Struggling:** Slowing >10% OR >15% off target pace
- **Surging:** Speeding up >5%
- **Steady:** Within tolerances
- **shouldBoost:** True if struggling OR past 85% of target distance

---

### 4. Story Curator

| Field | Value |
|-------|-------|
| **File** | `src/lib/agents/story-curator.ts` + `src/app/api/story-plan/route.ts` |
| **Model** | Claude Opus 4.6 (async, non-blocking) |
| **Trigger** | Async after first `idle_storytelling` trigger |
| **Cost/call** | ~$0.010 |

**Reads:**
- UserStore: `storyTopics`, `activityTypes`
- CoachingStore: topics covered so far
- RunStore: `persona`

**Produces (StoryPlan):**
```typescript
{
  title: string,            // "The Night Einstein Played Violin"
  topic: string,            // "science"
  arc: {
    part1: string,          // Setup
    part2: string,          // Rising action
    part3: string           // Resolution
  },
  keyFacts: string[]        // Supporting facts
}
```

**Stored in:** `CoachingStore.cachedStoryPlan` (session cache, reused across idle triggers)

**Topic selection:** Picks uncovered topic from user interests, rotates fallbacks (history, science, nature, culture, sports)

---

### 5. Quality Supervisor

| Field | Value |
|-------|-------|
| **File** | `src/lib/agents/quality-supervisor.ts` + `src/app/api/quality/route.ts` |
| **Model** | Claude Opus 4.6 (async, non-blocking) |
| **Trigger** | Every 3rd coaching message (`messageIndex % 3 === 0`) |
| **Cost/call** | ~$0.005 |

**Reads:**
- Previous coaching message text
- Trigger type, persona
- RunStore: distance, pace, elapsed
- CoachingStore: topics covered

**Produces (QualityReview):**
```typescript
{
  score: number,            // 1-5
  feedback: string,         // "Good energy match but slightly too long"
  issues: string[]          // ["slightly verbose", "off-topic"]
}
```

**Stored in:** `CoachingStore.qualityReviews[]` (session, max 10)

**Evaluation criteria:** Relevance, tone match, repetition avoidance, engagement, brevity

**Feedback integration:** `formatQualityFeedback()` extracts avg score from last 3 reviews. If < 3: "needs improvement". If >= 4: "continue this approach". Injected as COACHING NOTES in next Head Coach call.

---

### 6. Race Director (Global)

| Field | Value |
|-------|-------|
| **File** | `supabase/functions/race-director/index.ts` |
| **Model** | Claude Opus 4.6 |
| **Schedule** | Every 60 seconds |

**Reads:** `active_runners` table (all active runners grouped by location/distance/pace)

**Produces:** Broadcast messages ("50 runners crossing 5K right now!")

**Stored in:** `collective_events` table → broadcast via Supabase Realtime `runners:global`

---

### 7. Story Library (Global)

| Field | Value |
|-------|-------|
| **File** | `supabase/functions/story-library/index.ts` |
| **Model** | Claude Opus 4.6 |
| **Schedule** | Daily |

**Reads:** Topic list + activity type combinations

**Produces:** Pre-generated story seeds (32/day across 8 topics x 4 activity types)

**Stored in:** `story_seeds` table

---

### 8. Aggregate Stats (Global)

| Field | Value |
|-------|-------|
| **File** | `supabase/functions/aggregate-stats/index.ts` |
| **Model** | None (pure aggregation) |
| **Schedule** | Every 30 seconds |

**Reads:** `active_runners` per city channel

**Produces:** Aggregated runner count, avg pace, total distance

**Published to:** Supabase Realtime `runners:global` → CollectiveStore on all clients

---

## Data Flow Pipeline

### Full Coaching Pipeline (Trigger to Audio)

```
GPS TRACKER (watchPosition)
    │
    ├─► RunStore.addGpsPoint()
    │   ├─► gpsPoints[] (raw trail)
    │   ├─► distanceMeters (Haversine cumulative)
    │   ├─► currentPaceSecondsPerKm (30-sec rolling window)
    │   ├─► averagePaceSecondsPerKm (total / elapsed)
    │   └─► splits[] (on 1km boundaries)
    │
    ├─► IndexedDB backup (every 10s)
    │
    └─► Trigger Engine evaluates (every 3s)
        │
        ├─ split_complete:    new km crossed
        ├─ pace_drift:        >15% off target for 60s
        ├─ halfway:           50% of target distance
        ├─ final_push:        90% of target distance
        ├─ idle_storytelling:  3+ min without coaching
        └─ user_initiated:    runner taps mic / speaks
            │
            ▼ TRIGGER FIRES
    ┌───────────────────────────────────────────────┐
    │           CONTEXT BUILDER (sync, <100ms)       │
    │                                                │
    │  Pace Strategist ──► PaceAnalysis     (<5ms)   │
    │  Motivation Engine ──► MotivationState (<5ms)   │
    │  Story Curator ──► StoryPlan (cache hit, <1ms)  │
    │  Quality Reviews ──► feedback string  (<1ms)    │
    │  Coaching History ──► last 8 messages  (<5ms)   │
    └───────────────────────┬───────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────┐
    │    HEAD COACH — POST /api/coach               │
    │    Claude Opus 4.6 (streaming, 2-4s)          │
    │                                                │
    │    System prompt:                              │
    │    BASE + PERSONA + TRIGGER + PACE ANALYSIS    │
    │    + ENERGY STATE + STORY PLAN + COACHING NOTES │
    │    + PREVIOUS COACHING (last 8 messages)       │
    └───────────────────────┬───────────────────────┘
                            │
                            ▼ SSE stream
    ┌───────────────────────────────────────────────┐
    │    SENTENCE PARSER                             │
    │    Splits at [.!?] boundaries                  │
    │    Each sentence → onSentence() callback       │
    └───────────────────────┬───────────────────────┘
                            │
                            ▼ per sentence
    ┌───────────────────────────────────────────────┐
    │    AUDIO MANAGER                               │
    │                                                │
    │    POST /api/tts (ElevenLabs per sentence)     │
    │    ├─ Persona-specific voice ID                │
    │    ├─ Stability/similarity/style/speed config  │
    │    └─ Returns MP3 ArrayBuffer                  │
    │                                                │
    │    Web Audio API playback queue (max 2)        │
    │    ├─ Interrupt on user voice input             │
    │    ├─ Pause/resume with run state              │
    │    └─ Fallback: browser SpeechSynthesis         │
    └───────────────────────┬───────────────────────┘
                            │
                            ▼ after full response
    ┌───────────────────────────────────────────────┐
    │    POST-PROCESSING                             │
    │                                                │
    │    CoachingStore.addMessage()                   │
    │    ├─ summarizeMessage() — first sentence       │
    │    ├─ extractTopics() — proper nouns/quotes     │
    │    └─ detectCliffhanger() — regex patterns      │
    │                                                │
    │    [ASYNC] Quality Supervisor (every 3rd msg)   │
    │    └─ POST /api/quality → review stored         │
    │                                                │
    │    [ASYNC] Story Curator (on first idle trigger) │
    │    └─ POST /api/story-plan → cached             │
    └───────────────────────────────────────────────┘
```

### Run Persistence (On Finish)

```
User taps "Finish"
    │
    ├─► RunStore.finishRun() → status = 'finished'
    │
    ├─► Collect all session data:
    │   ├─ distance, elapsed, avgPace, splits, gpsPoints
    │   ├─ CoachingStore.history → coachingMessages
    │   └─ CollectiveStore.runnerCount → collectiveCount
    │
    ├─► buildRouteGeoJson(gpsPoints)
    │   └─ GeoJSON LineString: [[lng, lat, alt], ...]
    │
    ├─► completeRunRecord() → Supabase runs table
    │   ├─ status = 'completed'
    │   ├─ splits, gps_points, route_geojson (JSONB)
    │   ├─ coaching_messages (JSONB array)
    │   └─ collective_count
    │
    ├─► update_user_stats() trigger fires:
    │   ├─ total_distance_meters += distance
    │   ├─ total_runs += 1
    │   └─ streak updated (if consecutive day)
    │
    ├─► POST /api/recap → AI summary (Opus 4.6, 200 tokens)
    │   └─ Stored in runs.ai_summary
    │
    └─► On network failure: queueRunForSync() → IndexedDB
        └─ Synced on next app load via syncPendingRuns()
```

### Collective Presence Pipeline

```
Each active runner
    ├─► active_runners table (heartbeat every 30s)
    │
    ├─► City-sharded Realtime channels
    │   runners:sf ──┐
    │   runners:nyc ─┼──► aggregate-stats (every 30s)
    │   runners:london┘        │
    │                          ▼
    │                  runners:global channel
    │                          │
    │                          ▼
    │                  CollectiveStore on all clients
    │                  ├─ runnerCount
    │                  ├─ averagePaceSecondsPerKm
    │                  └─ recentEvents[]
    │
    └─► race-director (every 60s)
        ├─ Scan for patterns across all runners
        ├─ Generate broadcast message (Opus 4.6)
        └─► collective_events table → Realtime broadcast
```

---

## Data Storage Map

### Ephemeral Stores (Zustand — lost on refresh)

| Store | Purpose | Key Fields | Lifecycle |
|-------|---------|------------|-----------|
| **RunStore** | Live run metrics | `status`, `distanceMeters`, `elapsedSeconds`, `currentPaceSecondsPerKm`, `averagePaceSecondsPerKm`, `splits[]`, `gpsPoints[]`, `persona`, `targetPaceSecondsPerKm`, `targetDistanceMeters`, `runId` | Created on `startRun()`, reset on `resetRun()` |
| **CoachingStore** | Per-session coaching | `history[]` (max 8), `qualityReviews[]` (max 10), `cachedStoryPlan` | Reset on run end |
| **CollectiveStore** | Live social state | `runnerCount`, `recentEvents[]` (max 10), `averagePaceSecondsPerKm` | Updated via Realtime, session-wide |
| **UserStore** | Auth user profile | `user: UserProfile`, `isLoading`, `isAuthenticated` | Fetched on auth, persists via Supabase |
| **TimelineStore** | Community feed | `runs[]` (max 50), `isLoading` | Fetched on demand |

### Persistent Database (Supabase PostgreSQL)

| Table | Key Columns | RLS | Purpose |
|-------|-------------|-----|---------|
| **users** | `id`, `name`, `city`, `experience_level`, `preferred_persona`, `story_topics[]`, `distance_unit`, `activity_types[]`, `streak_current`, `total_distance_meters`, `total_runs` | Own profile only | User profiles + stats |
| **runs** | `id`, `user_id`, `distance_meters`, `elapsed_seconds`, `average_pace_seconds_per_km`, `splits` (JSONB), `gps_points` (JSONB), `route_geojson` (JSONB), `coaching_messages` (JSONB), `ai_summary`, `persona_used`, `collective_count` | Own runs only | Run history + data |
| **active_runners** | `user_id`, `run_id`, `display_name`, `city`, `current_distance_meters`, `current_pace_seconds_per_km`, `last_heartbeat`, `is_synthetic` | Public read, own write | Real-time presence |
| **collective_events** | `event_type`, `payload` (JSONB), `created_at` | Public read, service write | Broadcast feed |
| **story_seeds** | `topic`, `activity_type`, `story_arc` (JSONB), `key_facts[]` | Public read | Pre-generated stories |

### Offline Backup (IndexedDB via idb-keyval)

| Key | Data | Purpose |
|-----|------|---------|
| `runfestival_gps_points_[runId]` | `GpsPoint[]` | Crash recovery (saved every 10s) |
| `runfestival_pending_runs` | `CompleteRunParams[]` | Queue for failed completions, synced on next load |

---

## Cost Estimate

### Per 30-Minute Run

| Agent | Model | Calls/Run | Cost/Call | Total |
|-------|-------|-----------|-----------|-------|
| Head Coach | Opus 4.6 | ~8 | $0.015 | ~$0.12 |
| Story Curator | Opus 4.6 | ~3 | $0.010 | ~$0.03 |
| Quality Supervisor | Opus 4.6 | ~3 | $0.005 | ~$0.02 |
| Pace Strategist | Rule-based | every trigger | $0.00 | $0.00 |
| Motivation Engine | Rule-based | every trigger | $0.00 | $0.00 |
| ElevenLabs TTS | turbo_v2_5 | ~100 sentences | ~$0.00001 | ~$0.001 |
| **Total per run** | | | | **~$0.17** |

### Cost Guards

- Token limits per trigger type (200-600 max)
- Story Curator cached per session (avoids re-generation)
- Quality Supervisor runs every 3rd message (1/3 frequency)
- TTS Usage Tracker: 50K chars/session limit, 15 req/min rate limit
- Server-side text length guard: 1000 chars max per TTS request
- Background detection: TTS paused when app not visible

---

## Latency Budget

Target: **<5 seconds** from trigger to first audio word

```
Trigger evaluation:           ~3ms
Context builder:              ~50ms
├── Pace Strategist:          <5ms (rule-based)
├── Motivation Engine:        <5ms (rule-based)
├── Story Curator lookup:     <1ms (cache hit)
├── Quality Feedback:         <1ms (cache hit)
└── Coaching History:         <5ms (array lookup)
Head Coach first token:       ~1.5s
Head Coach first sentence:    ~1-2s
TTS for first sentence:       ~500ms-1s
Web Audio playback start:     ~100ms
────────────────────────────────────
TOTAL:                        ~4-5s
```

**Bottleneck:** Claude Opus response time (2-4s). Everything else is <100ms total.

---

## Migrations

1. `001_initial_schema.sql` — Core tables: users, runs, active_runners, collective_events + RLS + triggers
2. `002_add_activity_types.sql` — Activity types column + INSERT policy
3. `003_story_seeds_and_presence.sql` — Story seeds table, collective events, active runners cleanup
