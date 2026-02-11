-- Story seeds table for pre-generated stories
CREATE TABLE IF NOT EXISTS story_seeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_type TEXT NOT NULL DEFAULT 'running',
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  arc JSONB NOT NULL, -- { part1, part2, part3 }
  facts JSONB NOT NULL, -- array of key facts
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient topic + activity lookups
CREATE INDEX IF NOT EXISTS idx_story_seeds_activity_topic
  ON story_seeds(activity_type, topic);

-- Collective events table for Race Director outputs
CREATE TABLE IF NOT EXISTS collective_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- 'milestone_cluster', 'pace_match', 'distance_record'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  runner_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TTL index — auto-delete events older than 24 hours
CREATE INDEX IF NOT EXISTS idx_collective_events_created
  ON collective_events(created_at);

-- Active runners view for Race Director queries
CREATE OR REPLACE VIEW active_runners_summary AS
SELECT
  COUNT(*) as total_runners,
  AVG(EXTRACT(EPOCH FROM (NOW() - started_at))) as avg_duration_seconds,
  json_agg(DISTINCT city) FILTER (WHERE city IS NOT NULL) as cities
FROM runs
WHERE status = 'active'
  AND started_at > NOW() - INTERVAL '4 hours';

-- RLS policies for story seeds (public read, admin write)
ALTER TABLE story_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read story seeds" ON story_seeds
  FOR SELECT USING (true);

-- RLS for collective events (public read, service write)
ALTER TABLE collective_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collective events" ON collective_events
  FOR SELECT USING (true);
