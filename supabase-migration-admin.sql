-- ============================================================================
-- Admin Dashboard Migration: KV → Supabase
-- Run this in your Supabase SQL Editor before deploying the code changes.
-- ============================================================================

-- 1. Add health_status to books table (healthy / warnings / failed)
ALTER TABLE books ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'completed';

-- 2. Admin API call logs (replaces KV admin:api_calls:*)
CREATE TABLE IF NOT EXISTS admin_api_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  service TEXT NOT NULL,         -- anthropic, replicate, stripe, elevenlabs
  call_type TEXT,                -- story, validation, cover, spread, narration
  book_id TEXT,                  -- temp book ID (not FK — book may not exist yet)
  status INTEGER DEFAULT 200,
  duration_ms INTEGER DEFAULT 0,
  model TEXT,
  cost NUMERIC(10,4) DEFAULT 0,
  error TEXT,
  details JSONB
);
CREATE INDEX IF NOT EXISTS idx_admin_api_calls_created ON admin_api_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_api_calls_service ON admin_api_calls(service);

-- 3. Admin error logs (replaces KV admin:errors:*)
CREATE TABLE IF NOT EXISTS admin_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  service TEXT DEFAULT 'unknown',
  error_type TEXT DEFAULT 'error',
  book_id TEXT,
  error TEXT NOT NULL,
  details JSONB
);
CREATE INDEX IF NOT EXISTS idx_admin_errors_created ON admin_errors(created_at DESC);

-- 4. Admin validation logs (replaces KV admin:validations:*)
CREATE TABLE IF NOT EXISTS admin_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  book_id TEXT,
  page TEXT DEFAULT 'unknown',
  attempt INTEGER DEFAULT 1,
  text_score NUMERIC(4,2) DEFAULT 0,
  face_score NUMERIC(4,2) DEFAULT 0,
  scene_accuracy NUMERIC(4,2) DEFAULT 0,
  format_ok BOOLEAN DEFAULT TRUE,
  pass BOOLEAN DEFAULT FALSE,
  issues TEXT[] DEFAULT '{}',
  fix_notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_admin_validations_created ON admin_validations(created_at DESC);

-- 5. Admin config key-value store (replaces KV admin:config:* and admin:prompts:*)
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Admin user feedback (replaces KV admin:feedback:*)
CREATE TABLE IF NOT EXISTS admin_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  book_id TEXT,
  stars INTEGER DEFAULT 0,
  reaction TEXT,
  comment TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_created ON admin_feedback(created_at DESC);

-- 7. Admin experiments (replaces KV admin:experiments:*)
CREATE TABLE IF NOT EXISTS admin_experiments (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  hypothesis TEXT,
  target TEXT,
  status TEXT DEFAULT 'running',
  variant_a JSONB DEFAULT '{}',
  variant_b JSONB DEFAULT '{}',
  result JSONB
);

-- 8. Admin postgame analysis (replaces KV admin:postgame:*)
CREATE TABLE IF NOT EXISTS admin_postgame (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  book_id TEXT,
  overall_score NUMERIC(4,2),
  would_recommend BOOLEAN,
  scores JSONB,
  top_issue TEXT,
  data JSONB
);
CREATE INDEX IF NOT EXISTS idx_admin_postgame_book ON admin_postgame(book_id);

-- 9. Auto-cleanup: delete api_calls and errors older than 7 days (optional cron)
-- You can set up a Supabase cron job or pg_cron extension:
-- SELECT cron.schedule('cleanup-admin-logs', '0 3 * * *', $$
--   DELETE FROM admin_api_calls WHERE created_at < NOW() - INTERVAL '7 days';
--   DELETE FROM admin_errors WHERE created_at < NOW() - INTERVAL '7 days';
-- $$);
