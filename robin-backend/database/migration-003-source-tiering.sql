-- ============================================================
-- Migration 003: Source Tiering
-- Adds tier and reach_estimate to sources for weighted signals
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE sources ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 2 CHECK (tier IN (1, 2, 3));
ALTER TABLE sources ADD COLUMN IF NOT EXISTS reach_estimate TEXT;

-- Also add source_tier to content_items for denormalized access
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS source_tier INTEGER DEFAULT 2;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
