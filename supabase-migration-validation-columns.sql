-- Add missing columns to admin_validations table for the validation overhaul.
-- Run this in your Supabase SQL Editor BEFORE deploying the code changes.

ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS text_box_score NUMERIC(4,2);
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS likeness_score NUMERIC(4,2);
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS composite_score NUMERIC(4,2);
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS quality_tier TEXT;
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS fingers_ok BOOLEAN DEFAULT TRUE;
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 1;
