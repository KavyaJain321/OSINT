-- ============================================================
-- Migration 001: Intake Modes for client_briefs
-- Adds columns to support three intake modes
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS intake_mode TEXT 
  CHECK (intake_mode IN ('document', 'describe', 'entity')) DEFAULT 'describe';
ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS uploaded_document_url TEXT;
ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS uploaded_document_text TEXT;
ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS entity_names TEXT[] DEFAULT '{}';
ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS follow_up_answers JSONB DEFAULT '{}';
ALTER TABLE client_briefs ADD COLUMN IF NOT EXISTS auto_extracted_sources JSONB DEFAULT '[]';
