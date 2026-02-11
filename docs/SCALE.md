# SCALE.md — RunFestival Scaling Plan

What needs to change for 10K concurrent users, and what breaks at 100K.

---

## Current Architecture (Baseline: <100 users)

| Component | Technology | Limit |
|-----------|-----------|-------|
| Web server | Vercel Edge Functions | ~1000 concurrent connections per function |
| Database | Supabase PostgreSQL | Free tier: 500MB, 2 direct connections |
| Realtime | Supabase Realtime (presence) | 100 users per channel |
| AI coaching | Claude Opus 4.6 (streaming) | Rate-limited per API key |
| TTS | ElevenLabs Turbo v2.5 | 10K chars/month free tier |
| Auth | Supabase Auth | Unlimited on paid plans |
| Storage | Supabase Storage (not yet used) | Plan-dependent |

---

## At 10K Concurrent Users

### Database

**Problem:** 10K users generating runs = ~10K active rows + writes on every run completion. Free tier has 2 direct connections and 500MB storage.

**Changes needed:**
- [ ] Upgrade to Supabase Pro ($25/mo): 100 direct connections, 8GB storage
- [ ] Add connection pooling via Supabase PgBouncer (built-in on Pro)
- [ ] Add indexes on `runs.user_id` + `runs.started_at` (already exist)
- [ ] Add index on `runs.status` for active run queries
- [ ] Partition `runs` table by month if >1M rows
- [ ] Add `gps_points` compression — JSONB with 500+ points per run is large. Consider storing as binary or referencing Supabase Storage

```sql
-- Additional index for active run queries
CREATE INDEX idx_runs_status ON runs(status) WHERE status = 'active';
```

### Realtime Presence

**Problem:** Supabase Realtime has a **100-user limit per channel** for presence. Already solved with city-sharding (Phase 6), but 10K users across many cities will create many channels.

**Current solution:** City-sharded channels (`runners:sf`, `runners:nyc`) + global aggregation via Edge Function.

**Changes needed:**
- [ ] Ensure aggregate-stats Edge Function can handle 50+ city channels
- [ ] Add geographic region fallbacks (e.g., users without a city → `runners:global`)
- [ ] Monitor Realtime connection limits per project (Supabase Pro: 500 concurrent, Scale: 10K)
- [ ] Consider upgrading to Supabase Scale plan for >500 concurrent Realtime connections

### Claude API

**Problem:** 10K users × ~8 coaching calls/run = 80K API calls per "run wave." Claude's rate limits depend on tier.

**Estimated costs:** 10K runs × $0.17/run = **$1,700 per run wave**

**Changes needed:**
- [ ] Apply for higher Claude API rate limits (or use Batch API for non-streaming agents)
- [ ] Implement request queuing with backoff for rate limit errors
- [ ] Move Story Curator and Quality Supervisor to Haiku/Sonnet for cost reduction
  - Story Curator: Opus → Sonnet ($0.03 → $0.003 per call)
  - Quality Supervisor: Opus → Haiku ($0.02 → $0.001 per call)
  - **Savings:** ~40% cost reduction per run
- [ ] Add per-user rate limiting: max N coaching calls per hour
- [ ] Cache common coaching patterns (e.g., split announcements for common paces)

### ElevenLabs TTS

**Problem:** 10K users each generating ~8 TTS requests × ~100 chars = 8M characters. At $0.30/1K chars = **$2,400 per run wave.**

**Changes needed:**
- [ ] Upgrade to ElevenLabs Scale plan ($99/mo for 2M chars, then $0.24/1K)
- [ ] Implement TTS caching: common phrases like split announcements can be pre-generated
  - "Split 1 complete" + pace variants → cache ~50 audio clips
  - Saves ~30% of TTS requests
- [ ] Offer browser TTS as default for free-tier users, ElevenLabs as premium
- [ ] Add user-level TTS quota (e.g., 5K chars/run for free, unlimited for premium)
- [ ] The existing `tts-usage-tracker.ts` cost guards help here

### Vercel Edge Functions

**Problem:** Each coaching request = 1 streaming edge function invocation lasting 2-4 seconds. 10K concurrent runs = ~10K simultaneous long-running connections.

**Changes needed:**
- [ ] Vercel Pro plan ($20/mo) for higher concurrent execution limits
- [ ] Monitor function duration — Edge Functions have a 30-second default timeout
- [ ] Consider moving long-running operations (story planning, quality review) to Vercel Serverless Functions (longer timeout) or Supabase Edge Functions

### Authentication

**No changes needed.** Supabase Auth scales well. Magic link emails may need a custom SMTP provider at volume to avoid rate limits on the default Supabase email sender.

---

## At 100K Concurrent Users

### Database

**Problem:** 100K concurrent = millions of rows in `runs` per day. JSONB columns (`gps_points`, `splits`, `coaching_messages`) become very large.

**Changes needed:**
- [ ] Supabase Scale plan or self-hosted PostgreSQL
- [ ] Move `gps_points` to Supabase Storage (S3-compatible)
  - Store a reference URL in the `runs` table instead of inline JSONB
  - Reduces row size by 10-50x
- [ ] Implement table partitioning on `runs` by `started_at` (monthly partitions)
- [ ] Add read replicas for the recap/analytics queries
- [ ] Implement data retention policy: archive runs older than N months to cold storage
- [ ] Consider TimescaleDB extension for time-series GPS data

```sql
-- Example partitioning (requires PostgreSQL 12+)
CREATE TABLE runs_partitioned (LIKE runs INCLUDING ALL)
  PARTITION BY RANGE (started_at);

CREATE TABLE runs_2026_01 PARTITION OF runs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Realtime Presence

**Problem:** 100K users × city sharding = possibly 500+ channels. The aggregate-stats function needs to scan all of them.

**Changes needed:**
- [ ] Replace per-city channels with **regional channels** (e.g., `runners:us-west`, `runners:eu-west`)
  - ~20 regional channels instead of 500+ city channels
  - Aggregate function is much simpler
- [ ] Move presence tracking to a dedicated service (Redis Pub/Sub or dedicated WebSocket server)
- [ ] Use approximate counting (HyperLogLog) instead of exact presence counts
- [ ] Consider switching from Supabase Realtime to a dedicated real-time service (e.g., Ably, Pusher, or self-hosted WebSocket with Redis)

### Claude API

**Problem:** 100K × 8 calls = 800K API calls per run wave. Cost: **$17,000 per run wave.**

**Changes needed:**
- [ ] Multi-tier coaching model:
  - **Free tier:** Haiku for all agents ($0.02/run)
  - **Pro tier:** Sonnet for Head Coach, Haiku for specialists ($0.05/run)
  - **Premium tier:** Opus for Head Coach ($0.17/run)
- [ ] Implement coaching message caching:
  - Common triggers (split_complete for popular paces) → pre-generated responses
  - Cache hit rate of 20-30% saves significant cost
- [ ] Move rule-based agents to remain rule-based (already done)
- [ ] Implement prompt caching (Anthropic prompt caching feature) for the system prompt
  - Same system prompt across all users for a given persona → huge cache hit rate
- [ ] Queue non-critical agents (quality supervisor, story curator) with Anthropic Batch API (50% cheaper)

### ElevenLabs TTS

**Problem:** 100K users = ~80M chars = **$24,000 per run wave.**

**Changes needed:**
- [ ] Self-hosted TTS: Deploy an open-source TTS model (e.g., Coqui TTS, Piper)
  - Eliminates per-character cost entirely
  - GPU server cost: ~$500/mo for good quality
  - Latency may be higher — needs streaming optimization
- [ ] Pre-generate common coaching audio clips
- [ ] Hybrid: Self-hosted for common phrases, ElevenLabs only for personalized/storytelling content
- [ ] Browser TTS as free-tier default (zero cost)

### Infrastructure

**Changes needed:**
- [ ] CDN for static assets (Vercel handles this automatically)
- [ ] API rate limiting per user (already partially implemented with TTS tracker)
- [ ] Add Redis for:
  - Session caching (reduce Supabase auth calls)
  - TTS audio caching (common phrases)
  - Rate limiting state
  - Real-time presence aggregation
- [ ] Implement a job queue (BullMQ + Redis) for:
  - Quality supervisor reviews
  - Story plan generation
  - Run completion processing
  - AI recap generation
- [ ] Add monitoring: Datadog or Grafana for API latency, error rates, cost tracking
- [ ] Add circuit breakers for external APIs (Claude, ElevenLabs, Mapbox)

---

## Cost Projections

| Scale | Claude | ElevenLabs | Supabase | Vercel | Total/month |
|-------|--------|------------|----------|--------|-------------|
| 100 users | $17 | $24 | Free | Free | ~$41 |
| 1K users | $170 | $240 | $25 (Pro) | $20 (Pro) | ~$455 |
| 10K users | $1,700 | $2,400 | $25 (Pro) | $20 (Pro) | ~$4,145 |
| 100K users | $17,000* | $24,000** | $599 (Scale) | $400 (Enterprise) | ~$42,000 |

\* With multi-tier model routing and caching, realistically **$5,000-8,000**
\** With self-hosted TTS, realistically **$500-1,000**

**Optimized 100K cost estimate: ~$7,000-10,000/month**

---

## Priority Order for Scale Work

### Phase A: Quick Wins (Now)
1. Prompt caching for Claude system prompts (same persona → cache hit)
2. TTS caching for common split announcements
3. Per-user rate limits on API routes
4. Monitor costs with the existing `tts-usage-tracker`

### Phase B: 1K-10K Users
1. Upgrade Supabase to Pro plan
2. Upgrade ElevenLabs plan
3. Apply for higher Claude API rate limits
4. Move Story Curator + Quality Supervisor to Sonnet/Haiku
5. Add request queuing with backoff

### Phase C: 10K-100K Users
1. Multi-tier coaching (Free/Pro/Premium model routing)
2. Self-hosted TTS for common phrases
3. Move GPS data to object storage
4. Regional channel sharding for presence
5. Redis for caching + rate limiting
6. Job queue for async operations
7. Table partitioning on `runs`

---

## Key Architectural Decisions for Scale

1. **The rule-based agents (Pace Strategist, Motivation Engine) are already scalable** — they run in-browser with zero API cost. This was a good architectural choice.

2. **City-sharded presence channels** are the right pattern. At 100K, shift to regional channels.

3. **The streaming pipeline (Claude → sentence parser → TTS → audio)** adds latency but keeps cost per message low. At scale, the bottleneck is TTS cost, not Claude cost.

4. **JSONB columns for GPS data** will be the first scaling pain point. Plan to externalize early.

5. **The global agents (Race Director, Story Library) scale horizontally** — they're Edge Functions triggered by cron. Cost is fixed regardless of user count.
