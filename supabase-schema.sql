-- Supabase Database Schema for WhatsApp Anonymous Chat Bot

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'idle',
  preferences JSONB DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_pair_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Active pairs table
CREATE TABLE IF NOT EXISTS active_pairs (
  id TEXT PRIMARY KEY,
  user1 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation actions table
CREATE TABLE IF NOT EXISTS moderation (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  moderator_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics table (optional)
CREATE TABLE IF NOT EXISTS analytics (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_current_pair ON users(current_pair_id);
CREATE INDEX IF NOT EXISTS idx_active_pairs_user1 ON active_pairs(user1);
CREATE INDEX IF NOT EXISTS idx_active_pairs_user2 ON active_pairs(user2);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_moderation_user ON moderation(user_id);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Users policies (allow all for development)
CREATE POLICY "Allow all on users" ON users
  FOR ALL USING (true);

CREATE POLICY "Allow select on users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Allow insert on users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on users" ON users
  FOR UPDATE USING (true);

-- Active pairs policies
CREATE POLICY "Allow all on active_pairs" ON active_pairs
  FOR ALL USING (true);

-- Reports policies
CREATE POLICY "Allow insert on reports" ON reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select on reports" ON reports
  FOR SELECT USING (true);

-- Moderation policies
CREATE POLICY "Allow all on moderation" ON moderation
  FOR ALL USING (true);

-- Analytics policies
CREATE POLICY "Allow all on analytics" ON analytics
  FOR ALL USING (true);

-- Functions for matchmaking
CREATE OR REPLACE FUNCTION get_waiting_users()
RETURNS TABLE(id TEXT, preferences JSONB)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT id, preferences FROM users WHERE status = 'waiting';
$$;

-- Function to update user status
CREATE OR REPLACE FUNCTION update_user_status(user_id TEXT, new_status TEXT, pair_id TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE users
  SET status = new_status,
      current_pair_id = pair_id,
      updated_at = NOW()
  WHERE id = user_id;
$$;