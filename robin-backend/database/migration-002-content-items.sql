-- ============================================================
-- Migration 002: Content Items Table
-- Creates content_items as the unified content storage table
-- Keeps backward-compatible 'articles' view for existing code
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create the new content_items table
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  
  -- Content type discriminator
  content_type TEXT NOT NULL CHECK (content_type IN (
    'article', 'video', 'tweet', 'reddit', 'pdf', 
    'govt_release', 'press_release', 'podcast', 'tv_transcript'
  )) DEFAULT 'article',
  
  -- Core fields (same as articles)
  title TEXT,
  content TEXT,
  url TEXT NOT NULL,
  content_hash TEXT,
  title_hash TEXT,
  cross_source_duplicate_of UUID REFERENCES content_items(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  matched_keywords TEXT[] DEFAULT '{}',
  is_tagged BOOLEAN NOT NULL DEFAULT false,
  analysis_status TEXT NOT NULL CHECK (analysis_status IN (
    'pending', 'processing', 'complete', 'failed'
  )) DEFAULT 'pending',
  embedding vector(768),
  
  -- NEW: Content-type-specific metadata (JSONB)
  -- For articles: { author, thumbnail_url, og_image, word_count }
  -- For videos:   { channel_id, channel_name, duration, thumbnail_url, transcript }
  -- For tweets:   { author_handle, retweet_count, like_count, thread_id }
  -- For PDFs:     { page_count, file_size, thumbnail_url }
  -- For govt:     { department, document_number, classification }
  type_metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT content_items_url_unique UNIQUE (url),
  CONSTRAINT content_items_content_hash_unique UNIQUE (content_hash)
);

-- Step 2: Create indexes (matching articles indexes + new ones)
CREATE INDEX IF NOT EXISTS idx_content_items_client_id ON content_items(client_id);
CREATE INDEX IF NOT EXISTS idx_content_items_source_id ON content_items(source_id);
CREATE INDEX IF NOT EXISTS idx_content_items_published_at ON content_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_analysis_status ON content_items(analysis_status);
CREATE INDEX IF NOT EXISTS idx_content_items_content_hash ON content_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_items_content_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at ON content_items(created_at DESC);

-- Step 3: Copy existing articles into content_items
INSERT INTO content_items (
  id, client_id, source_id, content_type, title, content, url,
  content_hash, title_hash, published_at, matched_keywords,
  is_tagged, analysis_status, embedding, created_at
)
SELECT 
  id, client_id, source_id, 'article', title, content, url,
  content_hash, title_hash, published_at, matched_keywords,
  is_tagged, analysis_status, embedding, created_at
FROM articles
ON CONFLICT (id) DO NOTHING;

-- Step 4: Update foreign key references
-- article_analysis.article_id → add content_item_id
ALTER TABLE article_analysis ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE;
UPDATE article_analysis SET content_item_id = article_id WHERE content_item_id IS NULL;

-- entity_mentions.article_id → add content_item_id
ALTER TABLE entity_mentions ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE;
UPDATE entity_mentions SET content_item_id = article_id WHERE content_item_id IS NULL;

-- article_files → add content_item_id
ALTER TABLE article_files ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE;
UPDATE article_files SET content_item_id = article_id WHERE content_item_id IS NULL;

-- Step 5: Update sources table to support more types
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check 
  CHECK (source_type IN ('rss', 'html', 'browser', 'youtube', 'twitter', 'reddit', 'pdf', 'govt_portal', 'podcast'));

-- ============================================================
-- NOTE: We do NOT drop the articles table yet. The existing code
-- can continue to use it. New code should use content_items.
-- The articles table will be deprecated in a future migration
-- once all code has been updated.
-- ============================================================
