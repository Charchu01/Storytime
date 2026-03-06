-- Migration: Move vault characters and payment records from Vercel KV to Supabase
-- Run this against your Supabase database before deploying the updated API code.

-- ── Vault Characters ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_characters_user_id ON vault_characters (user_id);

-- ── Payment Records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  paid BOOLEAN NOT NULL DEFAULT false,
  tier TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_payment_records_session_id ON payment_records (session_id);
