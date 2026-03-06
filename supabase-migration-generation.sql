-- Migration: Add generation progress tracking to books table
-- Run this against your Supabase database to support resumable book generation.

ALTER TABLE books ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'completed';
ALTER TABLE books ADD COLUMN IF NOT EXISTS generation_progress JSONB DEFAULT '{}';

-- generation_status values: 'generating', 'completed', 'failed'
-- generation_progress stores: {
--   "totalPages": 6,
--   "completedPages": 3,
--   "currentStep": "spread_2",
--   "failedAt": "spread_3",
--   "error": "Image generation timed out"
-- }

CREATE INDEX IF NOT EXISTS idx_books_generation_status ON books (generation_status)
  WHERE generation_status != 'completed';
