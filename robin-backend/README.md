# ROBIN OSINT — Backend

Multi-tenant news intelligence SaaS. Monitors news sources, applies AI analysis, and serves insights via API.

## Tech Stack

- **Runtime**: Node.js v20+ with ES Modules
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL + pgvector + Auth)
- **AI**: Groq (Llama 3.1 70B for analysis, nomic-embed-text for embeddings)
- **Scraping**: RSS Parser, Cheerio, Playwright
- **Deployment**: Railway

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browser
npx playwright install chromium

# 3. Copy env template and fill in values
cp .env.example .env

# 4. Run database schema in Supabase SQL Editor
#    → database/schema.sql
#    → database/rls-policies.sql
#    → database/functions.sql

# 5. Start dev server
npm run dev

# 6. Test health
curl http://localhost:3001/health
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production server |
| `npm run dev` | Dev server with auto-reload |
| `npm run scrape` | Manual one-time scrape cycle |
| `npm run seed` | Populate test data |

## Architecture

```
src/
├── index.js          # Express entry point
├── config.js         # Centralized env validation
├── lib/              # Singleton clients (Supabase, Groq, Logger)
├── middleware/        # Auth, role checks, rate limiting
├── services/         # Keyword matching, dedup, article saving, embeddings
├── scrapers/         # RSS, HTML, Browser crawlers + orchestrator
├── ai/               # Analysis worker, batch intelligence, RAG chat
├── routes/           # All API endpoints
└── scheduler/        # Cron jobs
```

## API Endpoints

All routes require `Authorization: Bearer <jwt>` header.

- `GET /health` — Service health check
- `GET /api/articles` — Paginated article feed
- `GET /api/analytics/*` — Sentiment, volume, keyword, source analytics
- `POST /api/chat` — SSE streaming AI chat
- `GET/POST /api/sources` — Manage news sources
- `GET/POST /api/keywords` — Manage watch keywords
- `GET/POST /api/reports` — Generate intelligence reports
- `GET /api/admin/system-health` — System health (Super Admin)
