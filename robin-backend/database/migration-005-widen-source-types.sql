-- Migration 005: Widen source_type constraints to support all OSINT source types
-- Adds: reddit, google_news to both sources and brief_recommended_sources tables

-- 1. Update sources table constraint (already has youtube/reddit from migration-002, adding google_news)
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check 
  CHECK (source_type IN ('rss', 'html', 'browser', 'youtube', 'twitter', 'reddit', 'pdf', 'govt_portal', 'podcast', 'google_news'));

-- 2. Update brief_recommended_sources constraint (was limited to rss/html/browser/pdf/youtube)
ALTER TABLE brief_recommended_sources DROP CONSTRAINT IF EXISTS brief_recommended_sources_source_type_check;
ALTER TABLE brief_recommended_sources ADD CONSTRAINT brief_recommended_sources_source_type_check 
  CHECK (source_type IN ('rss', 'html', 'browser', 'youtube', 'pdf', 'reddit', 'google_news', 'twitter', 'govt_portal', 'podcast'));
