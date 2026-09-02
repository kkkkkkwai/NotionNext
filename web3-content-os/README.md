# Web3 Brand & Content OS · Web3 项目智能内容中台

> **Tell us about your project once. Your AI remembers everything.**
> One Project. One AI Brain. Unlimited Content.

An AI Brand Manager for Web3 projects. Every project gets an isolated, persistent **AI Brain** — structured facts, Project DNA, a vector knowledge base, long-term memory and content history — that powers a content engine (65 templates), Ask Project AI, a one-click Launch Kit, campaign generation, consistency and Web3 risk checks, and 8-language localisation.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS |
| Backend | Next.js Route Handlers (SSE streaming for chat) |
| Database | PostgreSQL + **pgvector** via Drizzle ORM. Zero-config local mode uses embedded **PGlite** (`./data/pglite`); set `DATABASE_URL` for Supabase / any Postgres |
| Auth | Email + password, scrypt hashes, signed JWT cookie |
| AI | Unified provider layer — OpenAI, Anthropic (official SDK), Google Gemini, OpenRouter, any OpenAI-compatible endpoint (DeepSeek, Grok, local). BYOK keys encrypted at rest (AES-256-GCM). Per-task model router + usage/cost accounting |
| Parsing | PDF (`pdf-parse`), DOCX (`mammoth`), PPTX (zip + XML), TXT/MD, website & GitBook crawler |

## Quick start

```bash
cd web3-content-os
cp .env.example .env         # set AUTH_SECRET; optionally DATABASE_URL and system AI keys
npm install
npm run dev                  # http://localhost:3100
```

1. Sign up (a personal workspace is created).
2. **Settings → AI Providers**: add a key (OpenAI / Anthropic / Gemini / OpenRouter / OpenAI-compatible) and click *Test*. Optionally route each task type (extraction, DNA, narrative, short content, long form, translation, consistency, risk, chat, memory, embeddings) to a different provider/model in the AI Router.
3. **New Project**: describe the project, upload whitepaper / deck / docs, paste the website or GitBook URL. The ingest job parses → chunks → embeds → extracts *Project Facts* (with source + page) → generates the *Project DNA* → computes *Readiness*.
4. **Ask Project AI**, **Content Generator**, **Launch Kit**, **Campaigns** — all read only this project's brain.

Without any AI key the app still runs: uploads, parsing, knowledge base (local hashed embeddings), memory, library and checks work; AI generation returns a clear "No AI provider configured" error.

## Architecture

```
Create Project → Import materials → Parse/Chunk/Embed (pgvector, project-scoped)
      → Fact extraction (sourced, versioned, lockable) → Project DNA (20 sections, single source of truth)
      → Narrative Engine (chain · 6 audience narratives · 5/20/50 themes & angles)
      → Dynamic Context Builder (task classification → relevant facts / DNA sections / memory / knowledge / content history)
      → LLM via AI Router → terminology enforcement → Content Library (versions) → Calendar / Campaigns
      → Consistency Engine (old → new value scan & bulk update) · Risk Check (Web3 compliance + fact cross-check)
```

**Memory priority**: user's current input > locked/confirmed facts > latest facts > Project DNA > long-term memory (terminology, brand rules, decisions) > knowledge base > content history > general model knowledge. AI-extracted values never overwrite confirmed/locked facts — conflicts are reported instead.

**Isolation**: every project table carries `project_id`; every query, including vector search, is filtered by it and by the caller's organization.

### Key directories

```
lib/db/schema.ts            all tables (users, organizations, projects, sources, documents, chunks, facts + versions,
                            dna, memories + events, conversations, messages, brand_rules, terminology, narratives,
                            content_templates, content_items + versions, campaigns + items, ai_providers/models/settings/requests/usage, generation_jobs)
lib/ai/                     provider adapters, router, pricing, usage logging, local embedding fallback
lib/rag/context-builder.ts  dynamic context assembly (never sends the whole whitepaper)
lib/services/               projects, knowledge, facts, memory, dna, narrative, templates, content, chat, checks,
                            campaigns, launch-kit, jobs, ingest-pipeline, ai-settings, usage
lib/prompts/system.ts       global system prompt (fact guard, no-invention rules, compliance)
app/api/                    REST + SSE endpoints
app/(app)/                  dashboard, project pages, settings
scripts/dev/                mock OpenAI-compatible LLM server + API/UI end-to-end tests
```

## Scripts

```bash
npm run dev / build / start   # port 3100
npm run typecheck             # tsc
npm run lint
npm run db:generate           # drizzle-kit migrations from schema
npm run db:migrate            # apply migrations (PGlite or DATABASE_URL)
npm run db:seed               # seed system content templates
```

### End-to-end tests without real API keys

```bash
node scripts/dev/mock-llm.mjs &                 # OpenAI-compatible mock on :3199
npm run build && npm run start &                # app on :3100
node scripts/dev/e2e-api.mjs                    # full pipeline: signup → provider → project → ingest → facts/DNA → chat memory → content → checks → campaign → launch kit
node scripts/dev/e2e-ui.mjs <email> <projectId> # Playwright pass over every route (desktop + mobile)
```

## Deploying with Supabase

1. Create a Supabase project; enable the `vector` extension (the first migration also runs `CREATE EXTENSION IF NOT EXISTS vector`).
2. Set `DATABASE_URL` to the Postgres connection string and `AUTH_SECRET` to a long random value.
3. `npm run build && npm run start` (or deploy to any Node host). Background jobs (ingest, launch kit, campaigns) run inside the Node process — use a long-running server rather than short-lived serverless functions.

## Roadmap (next phases)

- Supabase Auth / OAuth, team invitations and roles
- Billing & platform credits for system keys
- Social publishing (X / Telegram) and analytics
- Image poster rendering from poster copy
