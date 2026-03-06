-- ============================================================================
-- Storytime: Base Schema
-- Run this FIRST in Supabase SQL Editor, then run the migration files.
-- ============================================================================

-- ── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  books_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);

-- Helper function to increment book count
CREATE OR REPLACE FUNCTION increment_user_books(uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE users SET books_count = books_count + 1 WHERE id = uid;
END;
$$ LANGUAGE plpgsql;

-- ── Books ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Content
  title TEXT,
  dedication TEXT,
  author_name TEXT DEFAULT 'A loving family',
  story_idea TEXT,

  -- Story structure
  book_type TEXT,
  story_plan JSONB,
  story_format TEXT,
  tone TEXT,
  style TEXT,
  tier TEXT DEFAULT 'standard',

  -- Character info
  hero_name TEXT,
  hero_age INTEGER,
  hero_type TEXT,
  has_photo BOOLEAN DEFAULT false,
  character_count INTEGER DEFAULT 1,

  -- Status
  status TEXT DEFAULT 'generating',

  -- Metrics
  total_duration_ms INTEGER,
  total_cost NUMERIC(10,4) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books (user_id);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books (created_at DESC);

-- ── Book Pages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  page_type TEXT,
  page_index INTEGER DEFAULT 0,
  left_page_text TEXT,
  right_page_text TEXT,
  image_url TEXT,
  scene_description TEXT,
  layout_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_pages_book_id ON book_pages (book_id);

-- ── Activity Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  message TEXT,
  book_id UUID,
  user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log (created_at DESC);
