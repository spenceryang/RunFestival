-- RunFestival — Complete Database Schema
-- Consolidated from 001_initial_schema.sql + 002_add_activity_types.sql + 003_story_seeds_and_presence.sql
-- Run via: Supabase Dashboard → SQL Editor, or `supabase db push`

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Users table
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  experience_level TEXT DEFAULT 'intermediate' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  preferred_persona TEXT DEFAULT 'hype' CHECK (preferred_persona IN ('hype', 'calm', 'data', 'storyteller')),
  story_topics TEXT[] DEFAULT ARRAY['history', 'science'],
  distance_unit TEXT DEFAULT 'km' CHECK (distance_unit IN ('km', 'mi')),
  activity_types TEXT[] DEFAULT ARRAY['running'],
  privacy_level TEXT DEFAULT 'city_name' CHECK (privacy_level IN ('city_name', 'city_only', 'anonymous')),
  streak_current INT DEFAULT 0,
  streak_longest INT DEFAULT 0,
  streak_last_run_date DATE,
  total_distance_meters FLOAT DEFAULT 0,
  total_runs INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Runs table
-- ============================================================

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  distance_meters FLOAT DEFAULT 0,
  elapsed_seconds INT DEFAULT 0,
  average_pace_seconds_per_km FLOAT,
  target_distance_meters FLOAT,
  target_pace_seconds_per_km FLOAT,
  splits JSONB DEFAULT '[]'::JSONB,
  gps_points JSONB DEFAULT '[]'::JSONB,
  route_geojson JSONB,
  persona_used TEXT,
  coaching_messages JSONB DEFAULT '[]'::JSONB,
  ai_summary TEXT,
  collective_count INT,
  weather JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Active Runners (presence tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS active_runners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  display_name TEXT,
  city TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  current_distance_meters FLOAT DEFAULT 0,
  current_pace_seconds_per_km FLOAT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  is_synthetic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Collective Events (Race Director outputs)
-- ============================================================

CREATE TABLE IF NOT EXISTS collective_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  runner_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Story Seeds (pre-generated story arcs)
-- ============================================================

CREATE TABLE IF NOT EXISTS story_seeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_type TEXT NOT NULL DEFAULT 'running',
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  arc JSONB NOT NULL,
  facts JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_runners_last_heartbeat ON active_runners(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_collective_events_created ON collective_events(created_at);
CREATE INDEX IF NOT EXISTS idx_story_seeds_activity_topic ON story_seeds(activity_type, topic);

-- ============================================================
-- Views
-- ============================================================

CREATE OR REPLACE VIEW active_runners_summary AS
SELECT
  COUNT(*) as total_runners,
  AVG(EXTRACT(EPOCH FROM (NOW() - started_at))) as avg_duration_seconds,
  json_agg(DISTINCT city) FILTER (WHERE city IS NOT NULL) as cities
FROM runs
WHERE status = 'active'
  AND started_at > NOW() - INTERVAL '4 hours';

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Cleanup stale active runners (heartbeat older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_runners()
RETURNS void AS $$
BEGIN
  DELETE FROM active_runners
  WHERE last_heartbeat < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Update user stats on run completion
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    UPDATE users SET
      total_distance_meters = total_distance_meters + NEW.distance_meters,
      total_runs = total_runs + 1,
      streak_last_run_date = CURRENT_DATE,
      streak_current = CASE
        WHEN streak_last_run_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_current + 1
        WHEN streak_last_run_date = CURRENT_DATE THEN streak_current
        ELSE 1
      END,
      streak_longest = GREATEST(
        streak_longest,
        CASE
          WHEN streak_last_run_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_current + 1
          ELSE 1
        END
      ),
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
  AFTER UPDATE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- ============================================================
-- Enable Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE active_runners;
ALTER PUBLICATION supabase_realtime ADD TABLE collective_events;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE collective_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_seeds ENABLE ROW LEVEL SECURITY;

-- Users: can read/update/insert own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Runs: can read/write own runs
CREATE POLICY "Users can view own runs" ON runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON runs
  FOR UPDATE USING (auth.uid() = user_id);

-- Active runners: readable by all, writable by owner or service role for synthetics
CREATE POLICY "Anyone can view active runners" ON active_runners
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own active runner" ON active_runners
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role manages synthetic runners" ON active_runners
  FOR ALL USING (is_synthetic = true);

-- Collective events: readable by all, writable by service role
CREATE POLICY "Anyone can view collective events" ON collective_events
  FOR SELECT USING (true);
CREATE POLICY "Service role can insert events" ON collective_events
  FOR INSERT WITH CHECK (true);

-- Story seeds: readable by all
CREATE POLICY "Anyone can read story seeds" ON story_seeds
  FOR SELECT USING (true);
