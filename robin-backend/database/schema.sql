-- ============================================================
-- ROBIN OSINT — Complete Database Schema
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. clients — companies subscribed to the platform
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  custom_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. users — all people with access (linked to Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'ANALYST')),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- ============================================================
-- 3. sources — news sources each company monitors
-- ============================================================
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'html', 'browser')) DEFAULT 'rss',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  last_scrape_error TEXT,
  scrape_success_count INTEGER NOT NULL DEFAULT 0,
  scrape_fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. watch_keywords — keywords each company monitors
-- ============================================================
CREATE TABLE watch_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, keyword)
);

-- ============================================================
-- 5. articles — every scraped news article
-- ============================================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT,
  url TEXT NOT NULL,
  content_hash TEXT,
  title_hash TEXT,
  cross_source_duplicate_of UUID REFERENCES articles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  matched_keywords TEXT[] DEFAULT '{}',
  is_tagged BOOLEAN NOT NULL DEFAULT false,
  analysis_status TEXT NOT NULL CHECK (analysis_status IN ('pending', 'processing', 'complete', 'failed')) DEFAULT 'pending',
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT articles_url_unique UNIQUE (url),
  CONSTRAINT articles_content_hash_unique UNIQUE (content_hash)
);

-- ============================================================
-- 6. article_analysis — AI-generated results
-- ============================================================
CREATE TABLE article_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE UNIQUE,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  importance_score INTEGER CHECK (importance_score >= 1 AND importance_score <= 10),
  importance_reason TEXT,
  narrative_frame TEXT CHECK (narrative_frame IN ('crisis', 'recovery', 'accountability', 'conflict', 'human_interest', 'economic', 'none')),
  entities JSONB NOT NULL DEFAULT '{"people":[],"orgs":[],"locations":[],"figures":[]}',
  claims JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. entity_mentions — normalized entity tracking
-- ============================================================
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'org', 'location', 'figure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. narrative_patterns — nightly batch intelligence output
-- ============================================================
CREATE TABLE narrative_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pattern_date DATE NOT NULL,
  sentiment_breakdown JSONB,
  volume_data JSONB,
  top_entities JSONB,
  anomalies JSONB NOT NULL DEFAULT '[]',
  entity_cooccurrences JSONB NOT NULL DEFAULT '[]',
  source_sentiment JSONB NOT NULL DEFAULT '[]',
  weekly_narrative TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'elevated', 'high')) DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, pattern_date)
);

-- ============================================================
-- 9. article_files — media files attached to articles
-- ============================================================
CREATE TABLE article_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. reports — generated PDF intelligence reports
-- ============================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  date_from DATE,
  date_to DATE,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. chat_history — analyst chat conversations
-- ============================================================
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  articles_referenced UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 12. system_state — system-level flags (scraper lock)
-- ============================================================
CREATE TABLE system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Foreign key indexes
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_sources_client_id ON sources(client_id);
CREATE INDEX idx_watch_keywords_client_id ON watch_keywords(client_id);
CREATE INDEX idx_articles_client_id ON articles(client_id);
CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_article_analysis_article_id ON article_analysis(article_id);
CREATE INDEX idx_entity_mentions_article_id ON entity_mentions(article_id);
CREATE INDEX idx_entity_mentions_client_id ON entity_mentions(client_id);
CREATE INDEX idx_narrative_patterns_client_id ON narrative_patterns(client_id);
CREATE INDEX idx_article_files_article_id ON article_files(article_id);
CREATE INDEX idx_reports_client_id ON reports(client_id);
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_client_id ON chat_history(client_id);

-- Query-hot indexes
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_analysis_status ON articles(analysis_status);
CREATE INDEX idx_articles_content_hash ON articles(content_hash);
CREATE INDEX idx_entity_mentions_name_type ON entity_mentions(client_id, entity_name, entity_type);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at DESC);

-- pgvector similarity search index
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
