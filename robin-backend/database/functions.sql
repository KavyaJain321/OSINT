-- ============================================================
-- ROBIN OSINT — Database Functions
-- Run AFTER rls-policies.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- Function 1: match_articles
-- pgvector cosine similarity search for RAG chat
-- ============================================================
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding vector(768),
  p_client_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  url text,
  published_at timestamptz,
  source_id uuid,
  sentiment text,
  importance_score integer,
  summary text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.content,
    a.url,
    a.published_at,
    a.source_id,
    aa.sentiment,
    aa.importance_score,
    aa.summary,
    (1 - (a.embedding <=> query_embedding))::float AS similarity
  FROM articles a
  LEFT JOIN article_analysis aa ON aa.article_id = a.id
  WHERE a.client_id = p_client_id
    AND a.embedding IS NOT NULL
    AND (1 - (a.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Function 2: get_sentiment_trend
-- Daily sentiment counts for the last N days
-- ============================================================
CREATE OR REPLACE FUNCTION get_sentiment_trend(
  p_client_id uuid,
  p_days int DEFAULT 30
)
RETURNS TABLE (
  date date,
  positive_count bigint,
  negative_count bigint,
  neutral_count bigint,
  total bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.date::date,
    COUNT(*) FILTER (WHERE aa.sentiment = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE aa.sentiment = 'negative') AS negative_count,
    COUNT(*) FILTER (WHERE aa.sentiment = 'neutral') AS neutral_count,
    COUNT(*) AS total
  FROM generate_series(
    (now() - (p_days || ' days')::interval)::date,
    now()::date,
    '1 day'::interval
  ) AS d(date)
  LEFT JOIN articles a
    ON a.client_id = p_client_id
    AND a.published_at::date = d.date::date
    AND a.analysis_status = 'complete'
  LEFT JOIN article_analysis aa ON aa.article_id = a.id
  GROUP BY d.date
  ORDER BY d.date ASC;
END;
$$;

-- ============================================================
-- Function 3: get_entity_cooccurrences
-- Entities that appear together in the same article
-- ============================================================
CREATE OR REPLACE FUNCTION get_entity_cooccurrences(
  p_client_id uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  entity_a text,
  entity_b text,
  co_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e1.entity_name AS entity_a,
    e2.entity_name AS entity_b,
    COUNT(*) AS co_count
  FROM entity_mentions e1
  JOIN entity_mentions e2
    ON e1.article_id = e2.article_id
    AND e1.entity_name < e2.entity_name
  WHERE e1.client_id = p_client_id
    AND e2.client_id = p_client_id
  GROUP BY e1.entity_name, e2.entity_name
  ORDER BY co_count DESC
  LIMIT p_limit;
END;
$$;
