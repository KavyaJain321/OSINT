-- ============================================================
-- ROBIN OSINT — Temporal Intelligence Schema
-- Stores trend windows, detected patterns, and inference chains
-- ============================================================

-- Keyword/entity volume + sentiment tracked over time windows
CREATE TABLE IF NOT EXISTS temporal_trends (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,         -- keyword or entity name
    subject_type    TEXT NOT NULL,         -- keyword|entity|source|competitor
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    window_size     TEXT NOT NULL,         -- 2h|24h|7d|30d
    article_count   INTEGER DEFAULT 0,
    negative_count  INTEGER DEFAULT 0,
    positive_count  INTEGER DEFAULT 0,
    sentiment_score FLOAT DEFAULT 0,       -- -1 to 1
    importance_avg  FLOAT DEFAULT 0,
    top_sources     JSONB DEFAULT '[]',    -- [{source_name, count}]
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Detected intelligence patterns (velocity spikes, divergences, anomalies)
CREATE TABLE IF NOT EXISTS intelligence_patterns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    pattern_type      TEXT NOT NULL,
    -- velocity_spike|sentiment_shift|narrative_divergence|silence_anomaly|entity_emergence
    title             TEXT NOT NULL,
    description       TEXT,
    evidence          JSONB DEFAULT '[]',  -- [{article_id, quote, source, timestamp}]
    confidence        FLOAT DEFAULT 0.5,   -- 0-1
    severity          TEXT DEFAULT 'medium', -- critical|high|medium|low
    entities_involved JSONB DEFAULT '[]',
    is_acknowledged   BOOLEAN DEFAULT false,
    detected_at       TIMESTAMPTZ DEFAULT now(),
    expires_at        TIMESTAMPTZ           -- auto-expire stale patterns
);

-- Inference chains: connected event deductions
CREATE TABLE IF NOT EXISTS inference_chains (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    chain_steps           JSONB DEFAULT '[]',
    -- [{step_num, event, articles, timestamp, confidence}]
    conclusion            TEXT,
    conclusion_confidence FLOAT DEFAULT 0,
    severity              TEXT DEFAULT 'medium',
    scenario_7d           JSONB DEFAULT '[]',  -- [{scenario, probability, evidence}]
    scenario_30d          JSONB DEFAULT '[]',
    priority_action       JSONB,               -- {title, rationale, urgency}
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- Competitive benchmarks (weekly snapshot)
CREATE TABLE IF NOT EXISTS competitive_benchmarks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    week_start           DATE NOT NULL,
    client_sentiment     FLOAT DEFAULT 0,
    client_article_count INTEGER DEFAULT 0,
    competitor_data      JSONB DEFAULT '{}',
    -- {competitor_name: {sentiment, count, top_themes}}
    strategic_implications TEXT,
    created_at           TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, week_start)
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_temporal_trends_client   ON temporal_trends (client_id, subject, window_size);
CREATE INDEX IF NOT EXISTS idx_temporal_trends_window   ON temporal_trends (client_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_intel_patterns_client    ON intelligence_patterns (client_id, is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_intel_patterns_type      ON intelligence_patterns (pattern_type, detected_at);
CREATE INDEX IF NOT EXISTS idx_inference_chains_client  ON inference_chains (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_competitive_bench_client ON competitive_benchmarks (client_id, week_start);
