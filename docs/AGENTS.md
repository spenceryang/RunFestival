# AGENTS.md — RunFestival Multi-Agent Architecture

## Overview

RunFestival uses a multi-agent architecture where each running session is powered by a team of specialized AI agents. The key insight: **agents don't talk to each other in real-time**. They enrich a shared context that the Head Coach consumes. This keeps latency low.

## Per-User Agent Team

Every active run session has these agents:

```
┌─────────────────────────────────────────────────────────┐
│                   USER'S AGENT TEAM                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │         HEAD COACH (Opus 4.6)                     │    │
│  │  - Owns the voice: all output goes through here   │    │
│  │  - Receives enriched context from specialist agents│    │
│  │  - Makes final call on what to say and when       │    │
│  │  Triggers: all 6 types                            │    │
│  │  Tokens: 600 (story/voice) | 200 (alerts)        │    │
│  │  Streaming: yes                                   │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                │
│  ┌──────────┐  ┌───────┴──────┐  ┌──────────────────┐   │
│  │ PACE      │  │ STORY        │  │ MOTIVATION       │   │
│  │ STRATEGIST│  │ CURATOR      │  │ ENGINE           │   │
│  │           │  │ (Opus 4.6)   │  │                  │   │
│  │ Rule-based│  │              │  │ Rule-based       │   │
│  │ Zero cost │  │ Async, cached│  │ Zero cost        │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │         QUALITY SUPERVISOR (Opus 4.6)             │    │
│  │  - Reviews every 3rd coaching message (async)     │    │
│  │  - Score 1-5, feedback, issues list               │    │
│  │  - Feedback improves future coaching prompts      │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Head Coach

**File:** `src/app/api/coach/route.ts`
**Model:** Claude Opus 4.6
**Role:** The single voice of the coaching experience. Receives enriched context from all specialist agents and makes the final creative decision on what to say.

The system prompt includes:
- Base coaching rules (11 rules)
- Persona-specific personality (hype/calm/data/storyteller)
- Instructions to use PACE ANALYSIS, ENERGY STATE, STORY PLAN, and COACHING NOTES sections

### Pace Strategist

**File:** `src/lib/agents/pace-strategist.ts`
**Model:** None (rule-based)
**Cost:** Zero

Analyzes split data and produces:
- **Strategy classification:** even, negative, positive, erratic, or insufficient_data
- **Recent trend:** speeding_up, slowing_down, or steady
- **Projected finish time:** Based on current pace and target distance
- **Split variation:** Coefficient of variation as percentage
- **Advice string:** Human-readable coaching suggestion

### Motivation Engine

**File:** `src/lib/agents/motivation-engine.ts`
**Model:** None (rule-based)
**Cost:** Zero

Detects the runner's energy state:
- **struggling:** Slowing >10%, or >15% off target pace
- **steady:** Consistent pace within tolerance
- **surging:** Speeding up >5%

Produces approach guidance like:
- "Dig deep — the finish line is close"
- "They're in the zone — don't distract from flow state"
- "Early struggle — suggest settling into a comfortable rhythm"

### Story Curator

**File:** `src/lib/agents/story-curator.ts` + `src/app/api/story-plan/route.ts`
**Model:** Claude Opus 4.6
**Trigger:** Async, fired after first idle_storytelling trigger. Result cached.

Generates a 3-part story plan:
```json
{
  "title": "The Night Einstein Played Violin",
  "topic": "science",
  "arc": {
    "part1": "It's 1905 in Bern, and a patent clerk...",
    "part2": "His colleagues noticed something strange...",
    "part3": "The violin wasn't just relaxation..."
  },
  "keyFacts": ["Einstein filed 4 papers in 1905", "..."]
}
```

The Head Coach uses this as raw material, adapting it to the persona and moment.

### Quality Supervisor

**File:** `src/lib/agents/quality-supervisor.ts` + `src/app/api/quality/route.ts`
**Model:** Claude Opus 4.6
**Trigger:** Every 3rd coaching message (non-blocking, async)

Evaluates:
1. **Relevance** — Does it match the trigger type?
2. **Tone** — Does it match the persona?
3. **Repetition** — Does it avoid prior topics?
4. **Engagement** — Would a runner want to hear more?
5. **Brevity** — Appropriate length for audio?

Returns:
```json
{
  "score": 4,
  "feedback": "Good energy match but slightly too long for a split alert",
  "issues": ["slightly verbose"]
}
```

Feedback is injected into future coaching prompts as COACHING NOTES.

## Global Agents

These run across all users via Supabase Edge Functions.

### Race Director

**File:** `supabase/functions/race-director/index.ts`
**Model:** Claude Opus 4.6
**Schedule:** Every 60 seconds

Scans active runners and detects patterns:
- "50 runners are crossing the 5K mark right now"
- "Runners in Tokyo and NYC have matched pace"
- Distance milestone clusters

Uses Opus to generate exciting broadcast messages, stored in `collective_events` table.

### Story Library Curator

**File:** `supabase/functions/story-library/index.ts`
**Model:** Claude Opus 4.6
**Schedule:** Daily

Generates story seeds for each topic + activity type combination:
- 8 topics x 4 activity types = 32 potential stories per day
- Rotates topics daily to avoid API cost
- Stored in `story_seeds` table

### Aggregate Stats

**File:** `supabase/functions/aggregate-stats/index.ts`
**Model:** None
**Schedule:** Every 30 seconds

Aggregates presence data across city-sharded channels and publishes to `runners:global`. Enables the presence system to scale beyond the 100-user per-channel limit.

## Request Flow

```
Trigger fires (e.g., idle_storytelling)
    │
    ├─► [SYNC] Pace Strategist: analyze splits → { strategy, trend, advice }
    │   (Rule-based, ~0ms)
    │
    ├─► [SYNC] Motivation Engine: assess energy → { energyLevel, approach }
    │   (Rule-based, ~0ms)
    │
    ├─► [CACHED] Story Curator: get story plan → { title, arc, facts }
    │   (Pre-computed on previous idle trigger)
    │
    ├─► [CACHED] Quality Feedback: recent review insights
    │   (From previous async review)
    │
    └─► [SYNC] Head Coach (Opus 4.6): receives ALL enriched context
        │   System prompt: persona + pace analysis + energy state + story plan + quality notes
        │   Streams response → sentence parser → TTS → audio
        │
        └─► [ASYNC] Quality Supervisor: reviews this message (if 3rd)
            Stores score + feedback for next coaching call
```

**Critical latency path:** Only the Head Coach API call is on the critical path (~2-4s). All specialist agent outputs are either pre-computed, cached, or rule-based (0ms).

## Cost Estimate

| Agent | Model | Frequency | Est. Cost/Run |
|-------|-------|-----------|---------------|
| Head Coach | Opus 4.6 | ~8 calls/run | ~$0.12 |
| Story Curator | Opus 4.6 | ~3 async/run | ~$0.03 |
| Quality Supervisor | Opus 4.6 | ~3 reviews/run | ~$0.02 |
| Pace Strategist | Rule-based | Every trigger | $0.00 |
| Motivation Engine | Rule-based | Every trigger | $0.00 |
| **Total per 30-min run** | | | **~$0.17** |

## Presence Scaling

The presence system uses city-based channel sharding to scale beyond 100 users:

```
Runner in SF ──► runners:sf (city channel)
Runner in NYC ──► runners:nyc (city channel)
Runner in London ──► runners:london (city channel)
                              │
                              ▼
                   aggregate-stats Edge Function (every 30s)
                              │
                              ▼
                    runners:global (aggregated stats)
                              │
                              ▼
                    All clients receive total runner count
```

Each city channel handles its own presence state. The global channel receives aggregated stats from the Edge Function. This supports thousands of concurrent runners without hitting Supabase Realtime limits.

## Database Schema

### Tables Added
- `users` — User profiles (Phase 1)
- `runs` — Run records with full data (Phase 1)
- `story_seeds` — Pre-generated story plans (Phase 5)
- `collective_events` — Race Director outputs (Phase 5)

### Migrations
1. `001_initial_schema.sql` — Core schema (users, runs, RLS)
2. `002_add_activity_types.sql` — Activity types column + INSERT policy
3. `003_story_seeds_and_presence.sql` — Story seeds, collective events, active runners view
