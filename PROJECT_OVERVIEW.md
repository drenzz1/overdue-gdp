# TenderPilot Project Overview

TenderPilot is an AI-assisted tender analysis and bid drafting product. It targets SMEs, NGOs, construction firms, IT companies, and consultancies that need to understand public procurement documents and prepare compliant bids faster.

The project is based on `TenderPilot_HackathonIdea_GDG.pdf`.

## Product Scope

TenderPilot helps users upload a public tender document, extract the key requirements, identify missing qualification documents, draft bid sections, personalize the bid with company profile context, and simulate the likely bid score.

Core features:

- PDF ingestion and multimodal tender analysis
- Automatic extraction of eligibility criteria, deadlines, required documents, and scoring weights
- Gap analysis for missing qualification documents
- AI-drafted bid sections
- RAG over company profile documents for personalized bids
- Tender scoring simulation

## Current Architecture

The project is split into a Node.js TypeScript backend and a Next.js frontend.

```text
overdue-gdp/
  src/                 Node.js TypeScript backend
  frontend/            Next.js frontend
  prisma/              PostgreSQL schema and migrations
  TenderPilot_*.pdf    Original product brief
```

## Backend

Backend stack:

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL target database
- pgvector-ready schema for RAG

Main backend files:

- `src/server.ts` - starts the Fastify server
- `src/app.ts` - builds and registers the Fastify app
- `src/routes/healthRoutes.ts` - health endpoint
- `src/routes/tenderRoutes.ts` - tender analysis and bid draft endpoints
- `src/services/tenderService.ts` - orchestration for tender analysis, scoring, and drafts
- `src/services/extractionService.ts` - deterministic tender requirement extraction
- `src/services/gapAnalysisService.ts` - missing document and compliance gap analysis
- `src/data/sampleTender.ts` - demo tender data
- `src/types.ts` - shared backend domain types
- `src/db/prisma.ts` - Prisma client singleton

Backend endpoints:

- `GET /health`
- `GET /api/tenders/sample`
- `POST /api/tenders/analyze`
- `POST /api/tenders/analyze-file`
- `POST /api/bids/draft`

## Frontend

Frontend stack:

- Next.js App Router
- React
- TypeScript
- Plain CSS

Main frontend files:

- `frontend/app/page.tsx` - main TenderPilot workspace UI
- `frontend/app/globals.css` - frontend styles
- `frontend/app/layout.tsx` - Next.js root layout
- `frontend/next.config.ts` - Next.js config
- `frontend/package.json` - frontend scripts and dependencies

Frontend currently displays:

- Tender score
- Deadline risk
- Ready and missing document counts
- Tender snapshot
- Eligibility requirements
- Extraction review notes
- Compliance checklist
- Gap analysis with severity and recommendations
- Bid draft buttons for executive summary, technical approach, and team qualifications

## Database

Recommended database for deployment:

- Google Cloud SQL for PostgreSQL
- `pgvector` extension for RAG embeddings
- Cloud Storage for uploaded PDFs
- Secret Manager for `DATABASE_URL`

Prisma files:

- `prisma/schema.prisma`
- `prisma/migrations/000001_init/migration.sql`

Database models included:

- `Company`
- `CompanyDocument`
- `CompanyDocumentChunk`
- `Tender`
- `TenderRequirement`
- `TenderRequiredDocument`
- `TenderScoringWeight`
- `TenderGapItem`
- `BidDraft`
- `BidScore`

Database enums included:

- `TenderStatus`
- `RequirementType`
- `DocumentStatus`
- `GapSeverity`
- `DraftType`

The schema includes `CompanyDocumentChunk.embedding` as `vector(1536)` for future RAG search.

## Environment

Example environment file:

- `.env.example`

Variables:

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/tenderpilot?schema=public"
HOST="127.0.0.1"
PORT="3000"
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:3000"
```

For Google Cloud, `DATABASE_URL` should come from Secret Manager and point to Cloud SQL PostgreSQL.

## Scripts

Root backend scripts:

```bash
npm run dev
npm run dev:backend
npm run build
npm run start
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

Frontend scripts:

```bash
npm run dev:frontend
npm run build:frontend
npm run typecheck --prefix frontend
```

## Local Development

Install dependencies:

```bash
npm install
npm install --prefix frontend
```

Generate Prisma client:

```bash
npm run db:generate
```

## Start All Services

This project currently uses separate dev processes for backend and frontend.

Terminal 1 - backend:

```bash
cd /Users/pacenzur/Desktop/gdp/overdue-gdp
npm run dev:backend
```

Backend URL:

```text
http://127.0.0.1:3000
```

Terminal 2 - frontend:

```bash
cd /Users/pacenzur/Desktop/gdp/overdue-gdp
npm run dev:frontend
```

Frontend URL:

```text
http://127.0.0.1:3001
```

Terminal 3 - optional health check:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok","service":"tenderpilot-api"}
```

If using a local Postgres database, start Postgres before running migrations or database-backed features. The current demo API can run without Postgres because database persistence is not yet wired into the request flow.

Start backend:

```bash
npm run dev:backend
```

Backend runs at:

```text
http://127.0.0.1:3000
```

Start frontend in another terminal:

```bash
npm run dev:frontend
```

Frontend runs at:

```text
http://127.0.0.1:3001
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok","service":"tenderpilot-api"}
```

## Validation Commands

Commands used to verify the project:

```bash
npm run db:generate
npm run typecheck
npm run build
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm audit --audit-level=moderate
```

Prisma schema validation requires `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/tenderpilot?schema=public" npx prisma validate
```

## GitHub Project

GitHub repository:

```text
https://github.com/drenzz1/overdue-gdp
```

GitHub Project:

```text
https://github.com/users/drenzz1/projects/6
```

Created issues/cards:

- `#1` Automatic extraction of tender requirements
- `#2` Gap analysis for missing qualification documents
- `#3` PDF ingestion + multimodal tender analysis
- `#4` Tender scoring simulation
- `#5` RAG over company profile for personalized bids
- `#6` AI-drafted bid sections

Created local branches:

- `issue-1-automatic-extraction`
- `issue-2-gap-analysis`

Current work has been started on:

- `issue-1-automatic-extraction`
- partial implementation also supports `issue-2-gap-analysis`

## Deployment Direction

Recommended Google Cloud deployment:

```text
Frontend: Cloud Run, Firebase Hosting, or Vercel
Backend: Cloud Run
Database: Cloud SQL for PostgreSQL
Files: Cloud Storage
Secrets: Secret Manager
AI: Vertex AI or external LLM provider
Vector search: Cloud SQL PostgreSQL with pgvector, or AlloyDB/Vertex AI Vector Search later
```

For the MVP, use:

```text
Cloud Run + Cloud SQL PostgreSQL + Cloud Storage
```

## Notes

- Prisma is pinned to `6.19.3`.
- Prisma 7 was avoided because it changed datasource configuration and introduced audit issues in this environment.
- Generated outputs such as `dist/`, `.next/`, `node_modules/`, and `*.tsbuildinfo` are ignored by `.gitignore`.
- The current extraction logic is deterministic and designed as a replaceable layer before integrating real PDF parsing, OCR, vision, or LLM extraction.
