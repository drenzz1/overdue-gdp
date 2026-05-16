# TenderPilot

TenderPilot has a Node.js TypeScript backend and a separate Next.js frontend for turning public tender documents into a bid workspace. It is based on the supplied `TenderPilot_HackathonIdea_GDG.pdf` brief.

## Product Focus

- Upload a tender document and create an analysis workspace.
- Extract eligibility criteria, required documents, deadlines, and scoring weights.
- Show a compliance checklist with missing documents.
- Generate editable bid sections for executive summary, technical approach, and team qualifications.
- Simulate a bid score and export a Word-compatible bid document.

## Run Locally

```bash
npm install
npm install --prefix frontend
npm run dev
```

Backend runs at `http://127.0.0.1:3000`.

In another terminal, run:

```bash
npm run dev:frontend
```

Frontend runs at `http://localhost:3001`.

## API

- `GET /health`
- `GET /api/tenders/sample`
- `POST /api/tenders/analyze`
- `POST /api/tenders/analyze-file`
- `POST /api/bids/draft`

PDF parsing is represented by deterministic backend services suitable for demo purposes. The upload route derives a tender workspace from file metadata and profile notes, ready to swap for a real document AI pipeline.

## Database

The backend is prepared for PostgreSQL with Prisma. The schema lives in `prisma/schema.prisma` and includes tables for companies, company documents, tender extraction, required documents, gap analysis, bid drafts, scoring, and pgvector-backed RAG chunks.

Create a local `.env` from the example and point it at Postgres:

```bash
cp .env.example .env
npm run db:generate
npm run db:migrate
```

For Google Cloud, use Cloud SQL for PostgreSQL and set `DATABASE_URL` from Secret Manager. The initial migration enables `pgcrypto` and `vector`, so the target database must support the `pgvector` extension.

## Build

```bash
npm run typecheck
npm run build
npm run build:frontend
npm start
```
