# ROBIN OSINT — Full Enterprise-Grade System Audit
### Instruction Set for AI Agent (Antigravity / Cursor / Windsurf)

---

## ROLE & MINDSET

You are acting as a **Senior Principal Engineer** conducting a production readiness audit on an enterprise OSINT intelligence platform called ROBIN. This system ingests news from across the web, runs multi-pass AI analysis, detects threats and signals, and surfaces intelligence to users through a 12-page React dashboard and a RAG chat interface.

Your job is not to fix things yet. Your job is to **observe, probe, verify, and judge** with the precision of someone who has shipped systems at scale. You are looking for:
- What actually works vs. what merely appears to work
- Where data is real vs. where it is placeholder/stubbed/empty
- Where logic is correct vs. where it is computing nonsense with confidence
- Where UI truthfully represents data vs. where it is lying or showing stale state
- Where AI outputs are genuinely intelligent vs. superficially formatted

**Conduct this audit in order. Do not skip sections. Document every finding.**

---

## AUDIT STRUCTURE

You will audit **8 systems** in sequence:

1. Backend Pipeline (Scraping, Dedup, Scheduling)
2. AI Analysis Pipeline (Per-Article LLM Analysis)
3. Intelligence Engine (7-Pass Batch)
4. Temporal Analyzer & Inference Engine
5. RAG Chat System
6. Brief Intake System
7. Frontend Dashboard (all 12 pages)
8. Security & Infrastructure

At the end, produce a **Final Verdict Table** classifying every feature.

---

## HOW TO CONDUCT EACH CHECK

For every feature you audit, apply this 4-layer test:

| Layer | What to check |
|-------|---------------|
| **Code Layer** | Read the source file. Does the implementation match the spec? Is logic correct? Are edge cases handled? |
| **Data Layer** | Query Supabase directly. Is real data actually present? Are fields populated correctly? Are counts reasonable? |
| **API Layer** | Call the live endpoint. Does it return the right shape, correct values, and appropriate status codes? |
| **UI Layer** | Observe the frontend page. Does it display the data truthfully? Does it handle empty/error states well? Is it enterprise-grade in its presentation? |

---

## SYSTEM 1: BACKEND PIPELINE (Scraping, Dedup, Scheduling)

### 1.1 — Scraper Orchestrator

**Read:** `src/scrapers/orchestrator.js`

Check:
- Does the orchestrator correctly iterate over all active sources from the DB?
- Is the fallback chain implemented: RSS → HTML → Browser? Does it actually fall through, or does it stop at first failure?
- Is the scraper lock (DB-based) correctly acquired before scraping and released after — including on error/exception? A lock that is never released will freeze the system silently.
- Is error handling per-source isolated? (i.e., if source #3 fails, does #4 still run?)
- Does it update `last_scraped_at`, `success_count`, `fail_count` on the source record correctly?

**Query Supabase:**
```sql
SELECT name, source_type, last_scraped_at, success_count, fail_count, is_active
FROM sources
ORDER BY last_scraped_at DESC NULLS LAST
LIMIT 20;
```
- Are `last_scraped_at` timestamps recent (within the last 2-3 hours)?
- Are any sources showing `fail_count` >> `success_count`? These are broken sources.
- Are any sources showing `last_scraped_at = NULL`? These have never been scraped.

```sql
SELECT key, value, updated_at FROM system_state WHERE key = 'scraper_lock';
```
- Is the lock currently `true`? If yes and no scrape is running, the system is frozen. This is a critical bug.

**Trigger a manual scrape** via `POST /api/test/scrape` and observe:
- Does the endpoint respond immediately with a job ID / acknowledgment?
- Do new articles appear in the `articles` table within a reasonable time?
- Does `system_state.scraper_lock` go to `true` during the run and back to `false` after?

**Verdict questions:**
- Does the fallback chain actually work end-to-end, or is it only wired up in code but never exercised?
- Is the lock system safe against crashes?

---

### 1.2 — Individual Crawlers

**Read each:** `rss-crawler.js`, `html-crawler.js`, `browser-crawler.js`, `pdf-crawler.js`, `youtube-crawler.js`

For **RSS Crawler:**
- Is date extraction robust? Does it handle both `pubDate` (RSS) and `published`/`updated` (Atom)?
- Are articles without dates being given a fallback date, or silently dropped?
- Is the full article body being captured, or just the description snippet from the feed?

For **HTML Crawler:**
- Is it using a proper content extraction library (e.g., `@extractus/article-extractor`, `Readability`) or naive DOM traversal?
- Naive traversal will produce garbage for most news sites. Check the actual extracted text quality for a known source.

For **Browser Crawler:**
- Is Puppeteer/Playwright actually installed and launching? Many deployments silently fail here.
- Test it against a JS-rendered source. Does it return real article body or empty string?

For **PDF & YouTube Crawlers:**
- Are these actually wired into the orchestrator's fallback chain, or are they standalone-only?
- For YouTube: is transcript extraction working, or does it silently return empty on non-English/non-captioned videos?

**Query:**
```sql
SELECT source_type, COUNT(*) as article_count, AVG(LENGTH(content)) as avg_content_length
FROM articles a
JOIN sources s ON a.source_id = s.id
GROUP BY source_type;
```
- If `avg_content_length` for any type is < 200 characters, those crawlers are returning near-empty content — a silent quality failure.

---

### 1.3 — Deduplication

**Read:** `src/services/dedup-checker.js`

Check:
- Is URL dedup checking for exact match only, or is it normalized (strip UTM params, trailing slashes, http vs https)?
- Is title dedup using exact match or fuzzy similarity? Exact-only will miss "Reuters: X raises rates" vs "X raises rates - Reuters."
- Is `cross_source_duplicate_of` actually being set on duplicates, or just detected and dropped?
- Is dedup running BEFORE or AFTER saving to DB? (Must be before — otherwise you'll see duplicate insertions on high-volume runs.)

**Query:**
```sql
SELECT url, COUNT(*) as count FROM articles GROUP BY url HAVING COUNT(*) > 1 LIMIT 10;
```
- Any results here = dedup is broken for URL-level duplicates.

```sql
SELECT title, COUNT(*) as count FROM articles GROUP BY title HAVING COUNT(*) > 1 ORDER BY count DESC LIMIT 10;
```
- Repeated titles from different sources should have `cross_source_duplicate_of` set. Check if they do.

---

### 1.4 — Keyword Matching

**Read:** `src/services/keyword-matcher.js`

Check:
- Is matching case-insensitive?
- Does it match inside the article body, or only in the title?
- What is returned — an array of matched keywords, a boolean flag, or both?
- Is the result stored on the article record? In what column?

**Query:**
```sql
SELECT matched_keywords, COUNT(*) FROM articles
GROUP BY matched_keywords IS NULL
LIMIT 5;
```
- If most articles have `NULL` matched_keywords, the matcher is either not running or not saving results.

---

### 1.5 — Cron Scheduler

**Read:** `src/scheduler/cron.js`

Check:
- Is the cron expression correct for every-2-hours? (Should be `0 */2 * * *`)
- Is the nightly batch at 2am (`0 2 * * *`) correct?
- Are cron jobs protected from overlapping runs? (What happens if a scrape from 10pm is still running when the 2am batch triggers?)
- Is the scheduler initialized on app startup, or does it require a manual trigger?
- Is there any logging of cron execution so you can verify it actually ran?

---

## SYSTEM 2: AI ANALYSIS PIPELINE

### 2.1 — Analysis Worker

**Read:** `src/ai/analysis-worker.js`

Check:
- Is the polling interval actually 30 seconds, or is it configured differently in `.env`?
- How many articles does it process per batch? Is there a batch size limit?
- Is it correctly filtering for `analysis_status = 'pending'`?
- Does it correctly update status to `'processing'` before starting (to prevent double-processing if multiple workers run)?
- Does it handle `'failed'` status correctly — does it retry, or leave articles stranded?

**Query:**
```sql
SELECT analysis_status, COUNT(*) FROM articles GROUP BY analysis_status;
```
- A large number of `'pending'` articles means the worker is stalled.
- A large number of `'processing'` articles that never complete = worker is crashing mid-batch.
- `'failed'` articles = LLM is consistently failing and local fallback isn't catching them.

```sql
SELECT COUNT(*) FROM articles WHERE analysis_status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';
```
- Articles pending for > 1 hour = the worker is not running at all.

---

### 2.2 — Groq LLM Integration

**Read:** `src/lib/groq.js`

Check:
- Is the 6-key rotation correctly implemented? Does it move to the next key on `429 Too Many Requests` AND `401 Unauthorized`?
- Is the 3-model fallback (`llama-3.3-70b → llama-4-scout-17b → llama-3.1-8b`) triggered correctly?
- After all keys and models are exhausted, does it fall to local analyzer gracefully, or throw an unhandled exception?
- Are API keys stored securely in environment variables, not hardcoded?

**Test:**
- Intentionally rotate to a bad key. Does it fail over silently, or does it crash the worker?

---

### 2.3 — LLM Output Quality

This is the most important check in the entire audit. **The system can be technically correct but produce garbage AI analysis.** You must evaluate actual output quality.

**Query:**
```sql
SELECT
  a.title,
  aa.sentiment,
  aa.importance_score,
  aa.summary,
  aa.entities,
  aa.narrative_frame,
  aa.claims
FROM article_analysis aa
JOIN articles a ON aa.article_id = a.id
ORDER BY aa.created_at DESC
LIMIT 20;
```

For each record, evaluate:

**Sentiment:**
- Is it `positive/negative/neutral`?
- Does it match the article title? (A "bank collapse" article should not be `positive`.)
- Are the majority of articles `neutral`? (A sign of lazy analysis — real news skews negative.)

**Importance Score (1-10):**
- Is the distribution realistic? (Most should be 4-7. Clustering at 5 = the LLM is playing it safe and not scoring meaningfully.)
- Are genuinely important articles (wars, crises, major policy) scoring 8-10?
- Are trivial articles scoring 1-3?

**Summary:**
- Is it a real 2-sentence summary, or is it a paraphrase of the title?
- Does it add information the title doesn't already contain?
- Is it in proper English, or does it contain JSON artifacts or prompt leakage?

**Entities:**
- Are real named entities extracted (person names, organization names, locations)?
- Is the structure correct (JSON with `persons`, `orgs`, `locations` arrays)?
- Are entities relevant to the article, or hallucinated?

**Narrative Frame:**
- Is it one of the expected values: `crisis/reform/economic/conflict/human/etc`?
- Does it actually match the article content?

**Claims:**
- Are these factual assertions extracted from the article?
- Are they substantive or trivially obvious?

**Red flags to watch for:**
- Summary = title repeated verbatim → LLM is not reading the content
- All entities empty → embedding/extraction is failing silently
- All sentiments = neutral → LLM defaulting to safe mode
- Claims array is empty on every article → LLM is skipping this field
- JSON parse errors stored as strings in the field → prompt is not enforcing JSON output correctly

---

### 2.4 — Local Fallback Analyzer

**Read:** `src/services/local-analyzer.js`

Check:
- Is it being called only when Groq fails, or is it running for every article?
- Is the rule-based sentiment analysis using a real wordlist, or just checking for a handful of hardcoded words?
- Does it produce the same output schema as the LLM analyzer (same JSON structure)?
- Query articles analyzed by the fallback — are they visually distinguishable from LLM-analyzed ones?

```sql
SELECT analyzer_used, COUNT(*) FROM article_analysis GROUP BY analyzer_used;
```
(Assuming `analyzer_used` column exists — if not, this gap is itself a finding: you cannot tell which articles were analyzed by LLM vs fallback.)

---

### 2.5 — Embedding Generation

**Read:** `src/services/embedding.js`, `src/services/local-embeddings.js`

Check:
- Is the embedding model producing 768-dimensional vectors as specified?
- Are embeddings actually stored in the `articles.embedding` column?
- Is the local hash-based fallback meaningful enough to support RAG, or will it produce nonsensical similarity matches?

**Query:**
```sql
SELECT
  COUNT(*) as total,
  COUNT(embedding) as has_embedding,
  COUNT(*) - COUNT(embedding) as missing_embedding
FROM articles;
```
- If missing > 20% of total, semantic search in RAG chat is degraded.

---

## SYSTEM 3: INTELLIGENCE ENGINE (7-Pass Batch)

### 3.1 — Batch Intelligence Runner

**Read:** `src/ai/batch-intelligence.js`

Check:
- Are all 7 passes running in sequence, or are some commented out / skipped?
- If one pass fails, does it abort the entire batch or continue to remaining passes?
- Is there a log or record of when the last batch ran and whether it succeeded?

**Trigger manually:**
```
POST /api/test/scrape { "mode": "intelligence" }
```
- Watch console logs. Do all 7 passes execute?
- Check DB after completion.

---

### 3.2 — Pass 1: Entity Profiles

**Query:**
```sql
SELECT name, type, influence_score, mention_count, sentiment_profile, risk_tags, relationships
FROM entity_profiles
ORDER BY influence_score DESC
LIMIT 20;
```

Evaluate:
- Are `influence_score` values distributed across the 0-100 range, or are they all clustered (e.g., all near 50)?
- Is `sentiment_profile` a proper JSON object with `positive/negative/neutral` counts?
- Are `risk_tags` actually present and meaningful (e.g., `['high_negative_coverage', 'crisis_linked']`)?
- Are `relationships` populated showing entity co-occurrences?
- Are the top entities actually the most-covered entities in the news, or random?

---

### 3.3 — Pass 2: Threat Assessment

**Query:**
```sql
SELECT
  financial_score, regulatory_score, reputational_score,
  operational_score, geopolitical_score, overall_score,
  active_threats, threat_velocity, created_at
FROM threat_assessments
ORDER BY created_at DESC
LIMIT 5;
```

Evaluate:
- Are the 5 domain scores computed independently, or are they all the same value (a sign of a copy-paste bug)?
- Is `overall_score` a weighted combination, or just an average?
- Does `threat_velocity` have values of `accelerating/steady/decelerating`?
- Do scores make intuitive sense given the news content? (If global instability is high but geopolitical = 12, something is wrong.)
- Are `active_threats` populated as an array of specific threat descriptions?

---

### 3.4 — Pass 3: Temporal Intelligence

**Query:**
```sql
SELECT data FROM intelligence_patterns WHERE pattern_type = 'temporal' ORDER BY created_at DESC LIMIT 3;
```

Evaluate:
- Is there a 30-day daily volume timeline in the data?
- Are keyword velocity figures computed (48h vs prior 48h)?
- Are story lifecycle stages (`emerging/active/fading`) assigned?

---

### 3.5 — Pass 6: Intelligence Signals

**Query:**
```sql
SELECT signal_type, title, description, severity, confidence, acknowledged, expires_at, created_at
FROM intelligence_signals
ORDER BY created_at DESC
LIMIT 20;
```

Evaluate:
- Are all 6 signal types present (`volume_spike, entity_surge, sentiment_shift, new_entity, cross_source_confirmation, coordinated_coverage`)?
- Are severities correctly assigned (critical/warning/watch)?
- Are confidence values meaningful (a range of values, not all 0.5)?
- Is `expires_at` set to approximately 72h after creation?
- Are descriptions specific and informative, or generic like "Volume spike detected"?
- Are expired signals correctly excluded from the active count?

---

### 3.6 — Pass 7: Narrative Synthesis (LLM)

**Query:**
```sql
SELECT narrative_summary, risk_level, anomalies, key_themes, entity_co_occurrences, created_at
FROM narrative_patterns
ORDER BY created_at DESC
LIMIT 3;
```

Evaluate:
- Is `narrative_summary` a real paragraph of synthesized intelligence, or is it a template with empty variables?
- Does it reference specific entities, events, and themes from actual scraped articles?
- Is `risk_level` set (low/medium/high/critical)?
- Are `anomalies` and `key_themes` populated arrays?

**Critical test:** Read the narrative summary and ask yourself — *does this sound like a real intelligence brief, or does it sound like an LLM was given no context and hallucinated a generic summary?*

---

## SYSTEM 4: TEMPORAL ANALYZER & INFERENCE ENGINE

### 4.1 — Temporal Analyzer

**Read:** `src/ai/temporal-analyzer.js`

Check:
- Is it triggered correctly after each scrape cycle completion?
- Are all 5 detection algorithms implemented (velocity, sentiment drift, source divergence, silence anomaly, entity emergence)?
- Is the 7-day pattern expiry actually working?

**Query:**
```sql
SELECT pattern_type, title, description, severity, expires_at, created_at
FROM intelligence_patterns
ORDER BY created_at DESC
LIMIT 20;
```

Evaluate:
- Are patterns actually being generated, or is the table empty?
- Are `expires_at` values set to 7 days from creation?
- Are patterns from > 7 days ago still present (expiry not working)?

For each detection type, verify the threshold logic:
- `velocity`: Is the 2x spike (100% increase) correctly calculated as `(current - prior) / prior > 1.0`?
- `sentiment_drift`: Is the 30% shift calculated on the normalized -1 to 1 scale?
- `silence_anomaly`: Is the 80% coverage drop correctly compared against a rolling baseline, not just yesterday?

---

### 4.2 — Inference Engine

**Read:** `src/ai/inference-engine.js`

Check:
- Is the trigger condition correct — does it run when pattern count > 3?
- Is it assembling the full context (72h articles + patterns + entity profiles) before calling LLM?
- Is the LLM prompt structured to force: causal chains, absence detection, 14-day scenarios, priority action?

**Query:**
```sql
SELECT causal_chains, absence_signals, scenarios, priority_action, confidence, created_at
FROM inference_chains
ORDER BY created_at DESC
LIMIT 5;
```

Evaluate:
- Are causal chains showing A → B → C reasoning, or just restating article headlines?
- Are absence signals identifying what's NOT being covered (sophisticated) or just empty?
- Are 14-day scenarios specific and probabilistic (e.g., "60% probability that X will escalate to Y")?
- Is `priority_action` specific and actionable, or vague ("monitor situation")?

**This is the highest-value feature of the system. Generic, vague outputs here are a critical quality failure.**

---

## SYSTEM 5: RAG CHAT SYSTEM

### 5.1 — Semantic Search

**Read:** `src/ai/chat-rag.js`

Check:
- Is `match_articles` RPC being called with the correct parameters (query embedding, similarity threshold, match count)?
- Is the similarity threshold appropriate? (Too high = no results; too low = irrelevant results. 0.7-0.8 is typical.)
- Is keyword fallback being triggered correctly when vector search returns 0 results?

**Test directly:** Call the chat endpoint with a question that should match known articles.
```
POST /api/chat
{ "message": "What are the latest regulatory risks?" }
```
- Do the referenced article IDs match articles that are genuinely relevant to the question?
- Or are they random/wrong articles?

---

### 5.2 — Intelligence Context Injection

Check in `chat-rag.js`:
- Is threat matrix data being fetched and injected into the LLM prompt?
- Are top entity profiles included?
- Are active intelligence signals included?
- Is the narrative pattern summary included?

**This is critical.** Without this context, the RAG chat is just a basic Q&A bot with no intelligence layer — it's not OSINT, it's just search. Verify that the LLM system prompt contains real data from these tables, not placeholder text.

---

### 5.3 — Streaming Response Quality

Test in the browser on `/dashboard/chat`:
- Does the response stream token by token in real time, or does it wait for full completion and then dump everything at once?
- Is the streaming using SSE (Server-Sent Events) correctly? Check Network tab in browser DevTools — you should see `Content-Type: text/event-stream`.
- Does the frontend render markdown (bold, bullets, headers) or raw markdown syntax?
- Does typing stop and restart cleanly between messages?

**Quality of the response itself:**
Ask these specific questions and evaluate the answers:
1. "What are the most critical threats right now?"
2. "Which entities are most at risk?"
3. "What happened in the last 48 hours?"

Evaluate:
- Are responses grounded in actual scraped articles, or is the LLM hallucinating?
- Do responses cite specific article details, entity names, and dates?
- Are responses the quality of a senior intelligence analyst, or a generic chatbot?
- Is the response length appropriate (substantive but not padded)?

---

### 5.4 — Chat History

**Query:**
```sql
SELECT question, answer, referenced_article_ids, created_at
FROM chat_history
ORDER BY created_at DESC
LIMIT 10;
```
- Are conversations being saved?
- Are `referenced_article_ids` populated with actual article IDs?
- Verify those IDs correspond to articles that were actually relevant to the question.

---

## SYSTEM 6: BRIEF INTAKE SYSTEM

### 6.1 — Brief Submission Flow

**Read:** `src/routes/brief.js`, `src/ai/keyword-generator.js`, `src/ai/source-discoverer.js`

Submit a test brief:
```
POST /api/briefs
{
  "title": "FATF Compliance Risk for Southeast Asian Banks",
  "problem_statement": "We need to monitor FATF grey-listing risks, AML enforcement actions, and regulatory pressure on banking in Malaysia, Thailand, and Indonesia."
}
```

Check:
- Does brief save with `status: 'processing'` immediately?
- Does keyword generation complete within 60 seconds?
- Does source discovery complete within 60 seconds?
- Does status update to `'pending_review'` after both complete?

---

### 6.2 — Keyword Generation Quality

**Query:**
```sql
SELECT keyword, category, priority, rationale
FROM brief_generated_keywords
WHERE brief_id = '[your_test_brief_id]'
ORDER BY priority DESC;
```

Evaluate:
- Are all 6 categories represented (Primary, Entity, Semantic, Competitive, Temporal, Negative)?
- Are there approximately 32 keywords (the spec says ~32)?
- Are priorities meaningfully differentiated (not all 5)?
- Is `rationale` a real explanation or a one-word placeholder?
- Are the keywords actually relevant to the brief, or generic? (For FATF brief: "FATF", "grey-list", "AML", "Labuan FSA" are good. "finance", "bank" are too generic.)

---

### 6.3 — Source Discovery Quality

**Query:**
```sql
SELECT name, url, source_type, expected_hit_rate, rationale
FROM brief_recommended_sources
WHERE brief_id = '[your_test_brief_id]';
```

Evaluate:
- Are there ~15 sources?
- Are source types varied (rss/html/browser)?
- Are the URLs real, valid URLs (not hallucinated)?
- Do sources include wire agencies, regional media, and regulatory bodies as specified?
- Are expected hit rates realistic and varied?

**Critical check:** Are the recommended URLs actually accessible? Spot-check 3-5 of them. LLMs frequently hallucinate plausible-looking but non-existent RSS feed URLs.

---

### 6.4 — Admin Brief Review UI

Navigate to `/dashboard/admin/briefs`:
- Does the brief appear in the list?
- Are keywords displayed in a table with category, priority, rationale columns?
- Are checkboxes functional for approve/reject?
- Does "Activate Client" correctly push approved keywords to `watch_keywords` and approved sources to `sources`?
- After activation, do the new sources appear in `/dashboard/sources`?
- Do the new keywords appear in article matching going forward?

---

## SYSTEM 7: FRONTEND DASHBOARD (All Pages)

For each page, apply this evaluation framework:
- **Data presence:** Is real data showing, or empty states / zeros / placeholder text?
- **Data accuracy:** Does the displayed data match what's in the DB?
- **UI completeness:** Are all specified UI elements present and functional?
- **Error handling:** What happens when data is missing or an API call fails?
- **Enterprise quality:** Does this look like a $50,000/year SaaS tool, or a student project?

---

### 7.1 — Overview (`/dashboard`)

Specified elements:
- Stat cards: Articles (24h), Active Sources, Pending Analysis, Risk Score
- Active Signals list (top 8): severity dots, type, title, confidence %, time
- Risk Domains bars: Financial, Regulatory, Reputational + Overall score /100

Check:
- "Articles (24h)" — query `SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '24 hours'`. Does it match the displayed number?
- "Risk Score" — where does this number come from? Does it map to `threat_assessments.overall_score`? Is it the latest record?
- Active Signals — are they filtered to non-expired signals only? Is severity ordering correct (critical first)?
- Risk domain bars — are the values the same across all 3 domains (a bug sign) or independently computed?
- If any signals exist, do the confidence percentages match the DB values?

---

### 7.2 — Intelligence (`/dashboard/intelligence`)

Specified elements: Full intelligence report with inference chains and narrative patterns

Check:
- Is the narrative synthesis from Pass 7 displayed here?
- Are inference chains showing the causal reasoning (A → B → C), not just titles?
- Are detected temporal patterns listed?
- Is there a date/timestamp showing when the last intelligence batch ran?
- If no batch has run, is there a clear empty state with an explanation — or just a blank page?

---

### 7.3 — Signals (`/dashboard/signals`)

Specified elements: Full list of signals, severity filter (critical/high/medium/low), per-signal: badge, type, title, description, confidence %, time, acknowledged status

Check:
- Does the severity filter actually work? Test each filter option.
- Are acknowledged signals visually distinct from unacknowledged?
- Is there an "Acknowledge" action button, and does it persist the change to the DB?
- Are the signal descriptions informative, or generic one-liners?
- Are expired signals excluded from the list?

---

### 7.4 — Entities (`/dashboard/entities`)

Specified elements: Entity profiles sorted by influence score, each showing name, type, influence, mentions, sentiment, risk tags

Check:
- Are entities sorted by influence score descending?
- Is the `type` field (person/org/location) displayed correctly?
- Are `risk_tags` rendered as visual badges, not raw JSON strings?
- Is sentiment shown as a visual indicator (color, bar) or just a raw number?
- Clicking an entity — is there a detail view? If specified, is it working?

---

### 7.5 — Activity (`/dashboard/activity`)

Specified elements: 50 most recent articles, each with title (clickable), sentiment badge, importance score, time, summary, keywords; full card is clickable

Check:
- Click an article card — does it open the source URL in a new tab?
- Are sentiment badges color-coded (green/red/gray)?
- Are importance scores displayed prominently (not hidden in fine print)?
- Are summaries real 2-sentence summaries or empty?
- Are keywords shown as clickable chips? If clickable, what happens on click?
- Are articles sorted by recency? Check the timestamps.
- Are articles from the last 24h actually present?

---

### 7.6 — Sources (`/dashboard/sources`)

Specified elements: Source table with name, URL, type, active/inactive, last scraped, success/fail counts. Actions: add, delete, toggle active, trigger scrape.

Check:
- Does the "Toggle Active" button actually update `is_active` in the DB?
- Does "Trigger Scrape" call the manual scrape endpoint for that specific source?
- Does "Add Source" form validate URL format and source_type before saving?
- After adding a source, does it appear in the scraping cycle?
- Are success/fail counts updating after each scrape?
- Are timestamps in a human-readable format (not raw ISO strings)?

---

### 7.7 — Chat (`/dashboard/chat`)

Check:
- Do starter question chips appear on load?
- Clicking a chip — does it populate the input and submit?
- Does streaming work (word-by-word rendering)?
- Is there a loading indicator during the initial response delay?
- Can you send a follow-up question? Is context maintained?
- Is there a clear button / new conversation button?
- What happens if the backend is slow — does it time out gracefully?

---

### 7.8 — Reports (`/dashboard/reports`)

Check:
- What data does this page show? Is it distinct from Intelligence page?
- Are reports downloadable (PDF/CSV)?
- Is there a "Generate Report" action, and does it work?
- If empty, is there a clear empty state?

---

### 7.9 — Admin Brief Review (`/dashboard/admin/briefs`)

(Covered in System 6.4 above — cross-reference findings.)

Additional checks:
- Is this page protected so only `SUPER_ADMIN` role can access it?
- What happens if a non-admin user navigates to this URL directly?

---

### 7.10 — Debug (`/debug`)

Check:
- Are all 4 API connectivity tests running on page load?
- Do they correctly show pass/fail status?
- Is the backend URL being tested the production URL, not `localhost`?

---

## SYSTEM 8: SECURITY & INFRASTRUCTURE

### 8.1 — Authentication

Check:
- Is every API route (except public ones) protected by JWT middleware?
- What happens with an expired JWT — 401 or silent pass-through?
- What happens with no JWT header — 401 or data leak?

Test:
```bash
curl -X GET https://[your-api]/api/articles
# Should return 401, not data
```

### 8.2 — Role-Based Access

**Read:** `src/middleware/roleCheck.js`

Check:
- Are admin routes checking for `SUPER_ADMIN` role?
- Is role data coming from the JWT, or re-fetched from DB on each request? (JWT is faster but can be stale if roles change.)

### 8.3 — Rate Limiting

- Is rate limiting applied to the `/api/chat` endpoint? (Streaming endpoints are expensive.)
- Is the scrape trigger endpoint rate-limited? (Abuse could cause resource exhaustion.)
- What are the current limits? Are they appropriate for production use?

### 8.4 — CORS & Security Headers

Check:
- Is CORS restricted to your actual frontend domain(s), not `*`?
- Are Helmet.js security headers present? (Check browser DevTools → Network → Response Headers for `X-Content-Type-Options`, `X-Frame-Options`, etc.)

---

## FINAL VERDICT

After completing all checks above, produce the following table:

```
ROBIN OSINT — Feature Audit Verdict
Audited by: [Agent Name]
Date: [Date]
```

| # | Feature | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 1 | RSS Crawler | ✅ / ⚠️ / ❌ / 🕳️ | [what you found] | [what's wrong] |
| 2 | HTML Crawler | | | |
| 3 | Browser Crawler | | | |
| 4 | PDF Crawler | | | |
| 5 | YouTube Crawler | | | |
| 6 | Fallback Chain | | | |
| 7 | Scraper Lock | | | |
| 8 | Cron Scheduler | | | |
| 9 | Manual Scrape Trigger | | | |
| 10 | Deduplication (URL) | | | |
| 11 | Deduplication (Cross-source) | | | |
| 12 | Keyword Matching | | | |
| 13 | LLM Article Analysis | | | |
| 14 | Analysis Quality — Sentiment | | | |
| 15 | Analysis Quality — Importance Score | | | |
| 16 | Analysis Quality — Summary | | | |
| 17 | Analysis Quality — Entities | | | |
| 18 | Analysis Quality — Narrative Frame | | | |
| 19 | Groq Key Rotation | | | |
| 20 | Model Fallback Chain | | | |
| 21 | Local Fallback Analyzer | | | |
| 22 | Embedding Generation | | | |
| 23 | Batch Intelligence — Entity Profiles | | | |
| 24 | Batch Intelligence — Threat Matrix | | | |
| 25 | Batch Intelligence — Temporal Pass | | | |
| 26 | Batch Intelligence — Network Analysis | | | |
| 27 | Batch Intelligence — Source Intelligence | | | |
| 28 | Batch Intelligence — Predictive Signals | | | |
| 29 | Batch Intelligence — Narrative Synthesis | | | |
| 30 | Temporal Analyzer — Velocity | | | |
| 31 | Temporal Analyzer — Sentiment Drift | | | |
| 32 | Temporal Analyzer — Source Divergence | | | |
| 33 | Temporal Analyzer — Entity Emergence | | | |
| 34 | Temporal Analyzer — Silence Anomaly | | | |
| 35 | Pattern Expiry (7-day) | | | |
| 36 | Inference Engine — Causal Chains | | | |
| 37 | Inference Engine — Absence Detection | | | |
| 38 | Inference Engine — 14-Day Scenarios | | | |
| 39 | Inference Engine — Priority Actions | | | |
| 40 | RAG Chat — Semantic Search | | | |
| 41 | RAG Chat — Keyword Fallback | | | |
| 42 | RAG Chat — Intelligence Context Injection | | | |
| 43 | RAG Chat — Streaming Response | | | |
| 44 | RAG Chat — Response Quality | | | |
| 45 | Chat History | | | |
| 46 | Brief Submission | | | |
| 47 | Keyword Generation — Quality | | | |
| 48 | Source Discovery — Quality | | | |
| 49 | Brief Review Workflow | | | |
| 50 | Dashboard — Overview | | | |
| 51 | Dashboard — Intelligence | | | |
| 52 | Dashboard — Signals | | | |
| 53 | Dashboard — Entities | | | |
| 54 | Dashboard — Activity | | | |
| 55 | Dashboard — Sources | | | |
| 56 | Dashboard — Chat | | | |
| 57 | Dashboard — Reports | | | |
| 58 | Dashboard — Admin Brief Review | | | |
| 59 | JWT Authentication | | | |
| 60 | Role-Based Access Control | | | |
| 61 | Rate Limiting | | | |
| 62 | CORS & Security Headers | | | |

### Status Key:
- ✅ **Fully Correct** — Works as specified, enterprise quality
- ⚠️ **Partially Working** — Core function works but with defects, quality issues, or incomplete behavior
- ❌ **Fully Broken** — Does not function at all, or produces clearly wrong outputs
- 🕳️ **Superficial / Hollow** — Feature appears present but produces empty, meaningless, or trivially generic outputs; technically running but delivers no real intelligence value

---

## AFTER THE AUDIT

Once you have your verdict table, group findings by urgency:

**P0 — Fix immediately (system is broken):**
All ❌ items. The system cannot be used at all for these features.

**P1 — Fix before any client sees this (quality failure):**
All 🕳️ items. These will destroy trust if a client pays for this system and sees hollow outputs.

**P2 — Fix soon (degraded but usable):**
All ⚠️ items. System works but not at the quality level an enterprise client expects.

**P3 — Enhancement (working, could be better):**
✅ items with minor notes.

Present P0 and P1 findings first. These are the ones that matter most.

---

*This audit was designed for ROBIN OSINT v1.0 by a principal engineer with experience shipping production systems at scale. The goal is to find the truth about what this system actually does — not what it was intended to do.*
