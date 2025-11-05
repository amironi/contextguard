-- ContextGuard Supabase Schema
-- This schema defines tables for agent-dashboard communication

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent Policies Table
-- Stores security policies configured from the UI
CREATE TABLE IF NOT EXISTS agent_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL UNIQUE,
  policy JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Events Table
-- Stores all security events reported by agents
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Status Table
-- Tracks agent health and last seen time
CREATE TABLE IF NOT EXISTS agent_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'error')),
  last_seen TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_agent_id ON security_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_security_events_session_id ON security_events(session_id);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_policies_agent_id ON agent_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_agent_id ON agent_status(agent_id);

-- Enable Row Level Security (RLS)
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow service role to do everything
CREATE POLICY "Service role has full access to agent_policies"
  ON agent_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to security_events"
  ON security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to agent_status"
  ON agent_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read their agent policies"
  ON agent_policies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read security events"
  ON security_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read agent status"
  ON agent_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update their policies
CREATE POLICY "Users can insert agent policies"
  ON agent_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update agent policies"
  ON agent_policies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_agent_policies_updated_at
  BEFORE UPDATE ON agent_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_status_updated_at
  BEFORE UPDATE ON agent_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old events (optional - run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM security_events
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for event statistics
CREATE OR REPLACE VIEW event_statistics AS
SELECT
  agent_id,
  event_type,
  severity,
  COUNT(*) as count,
  DATE_TRUNC('hour', timestamp) as hour
FROM security_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY agent_id, event_type, severity, DATE_TRUNC('hour', timestamp);
