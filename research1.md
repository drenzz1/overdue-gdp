# TenderPilot — Deep Technical Research Report

## Overview

TenderPilot is a full-stack web application that helps companies in Kosovo and the Balkans analyze public-procurement tender documents, score their bid readiness, identify missing documents, and generate draft bid text. It is a hackathon-grade monorepo with a Fastify (Node.js / TypeScript) backend and a Next.js (React / TypeScript) frontend.

---

## Repository Structure

```
overdue-gdp/
├── package.json              # Backend root — scripts, deps, project name "tenderpilot"
├── src/                      # Fastify backend
│   ├── server.ts             # Process entry point
│   ├── app.ts                # Fastify app factory
│   ├── types.ts              # Shared domain types
│   ├── data/
│   │   └── sampleTender.ts   # Hard-coded demo tender fixture
│   ├── routes/
│   │   ├── healthRoutes.ts
│   │   ├── tenderRoutes.ts
│   │   └── companyRoutes.ts
│   └── services/
│       ├── tenderService.ts
│       ├── extractionService.ts
│       ├── scoringService.ts
│       ├── gapAnalysisService.ts
│       ├── companyProfileService.ts
│       └── documentAnalysisService.ts
└── frontend/                 # Next.js frontend
    ├── package.json
    ├── next.config.ts
    └── app/
        ├── layout.tsx
        ├── page.tsx          # Entire UI — single React component
        └── globals.css
```

---

## Backend

### Entry Point and App Factory

**`src/server.ts`** — Reads `PORT` (default `3000`) and `HOST` (default `127.0.0.1`) from environment, calls `buildApp()`, and starts listening. Exits on error.

**`src/app.ts`** — Pure factory function `buildApp()` that:
1. Creates a Fastify instance with built-in logger enabled.
2. Registers `@fastify/cors` with `origin: true` (permissive — any origin allowed).
3. Registers `@fastify/multipart` with a 20 MB / 1 file limit.
4. Registers three route groups: health, tender, company.

No database is used. All state is in-memory (a module-level variable in `companyProfileService.ts`).

---

### Domain Types (`src/types.ts`)

All types are plain TypeScript interfaces / type aliases. There is no runtime validation (no Zod, no JSON Schema).

| Type | Purpose |
|---|---|
| `TenderDocument` | One checklist item: `name`, `owner`, `ready` boolean, optional `evidence` and `reviewReason` |
| `TenderWeight` | Scoring criterion: `label` and numeric `value` (points) |
| `TenderProfile` | Full tender: title, buyer, region, deadline, value, language, channel, criteria string[], weights[], documents[] |
| `DraftType` | `"summary" \| "technical" \| "team"` |
| `ScoreFactor` | Per-weight scoring result: label, weight, earned, reason string |
| `GapStatus` | `"ready" \| "missing" \| "review"` |
| `GapAnalysisItem` | Per-document gap: name, owner, status, severity (Low/Medium/High), reason, recommendation, optional evidence |
| `GapAnalysisSummary` | Aggregate gap stats: totals, canQualify flag, qualification message, ownerBreakdown[], blockers[] |
| `AnalysisResult` | Top-level response: tender, source, score, scoreBreakdown[], scoreExplanation, deadlineRisk, missingDocuments[], gapAnalysis[], gapSummary, reviewItems[] |
| `AnalyzeTenderInput` | Input for the analyze endpoint: fileName, fileSize, notes, documentText, availableDocuments[] |
| `CompanyDocumentCategory` | `"certification" \| "reference" \| "cv" \| "capability" \| "legal"` |
| `CompanyDocument` | Company-side document: id, name, category, description, tags[] |
| `CompanyProfile` | Company: name, description, capabilities[], documents[] |

---

### Routes

#### `GET /health`
Returns `{ status: "ok", service: "tenderpilot-api" }`. Used for uptime checks.

#### `GET /api/tenders/sample`
Calls `getSampleAnalysis()`, which runs the full analysis pipeline over the hard-coded `sampleTender` fixture and returns a complete `AnalysisResult`. No input required.

#### `POST /api/tenders/analyze`
Body: `{ fileName?, fileSize?, notes?, documentText?, availableDocuments? }`.

- If `fileName` is absent, falls through to `getSampleAnalysis()` (demo mode).
- Otherwise calls `extractTenderRequirements(input, profile)` then `buildAnalysisResult(...)`.
- Always passes the current in-memory `CompanyProfile` from `companyProfileService`.

#### `POST /api/tenders/analyze-file`
Multipart form upload.
- Validates that exactly one file is present, that it is a PDF (by MIME type or `.pdf` extension), and that it is ≤ 20 MB.
- Reads optional `notes` field from the multipart fields map.
- Calls `defaultDocumentAnalysisProvider.analyzeDocument(buffer, filename, mime)` to extract text. The current provider (`TextExtractionProvider`) simply converts the buffer to a UTF-8 string — no real PDF parsing is implemented.
- Passes extracted text into `analyzeTender(input, getProfile())`.

#### `POST /api/bids/draft`
Body: `{ type?, tender?, companyProfile? }`.
- `type` must be `"summary"`, `"technical"`, or `"team"` (validated against a Set).
- `tender` defaults to `getSampleAnalysis().tender`.
- Returns `{ type, draft: string }`.

#### `GET /api/company/profile`
Returns a deep clone of the current in-memory `CompanyProfile`.

#### `POST /api/company/profile`
Body: `CompanyProfile`. Requires `name`. Overwrites the in-memory profile. Does not persist to disk.

#### `POST /api/company/profile/documents`
Body: `Omit<CompanyDocument, "id"> & { id? }`. Requires `name` and `category`. Auto-generates `id` as `doc-${Date.now()}` if not provided. Pushes the document into the in-memory profile's `documents` array.

---

### Services

#### `companyProfileService.ts`
Module-level singleton `currentProfile: CompanyProfile`. Pre-seeded with a "Demo Company" fixture that includes three documents (business registration cert, PM CV, implementation methodology) with tags for keyword matching.

- `getProfile()` — returns a deep clone.
- `setProfile(profile)` — overwrites state with a deep clone.
- `addDocument(doc)` — pushes a shallow copy into `currentProfile.documents`.
- `retrieveContext(tenderText)` — RAG-lite: lowercases the tender text, then returns all company documents whose `tags` or `name` appear in the text, and all `capabilities` that appear in the text. This is pure substring matching — no embeddings.

#### `documentAnalysisService.ts`
Defines the `DocumentAnalysisProvider` interface with a single method `analyzeDocument(buffer, fileName, mimeType): Promise<DocumentAnalysisResult>`.

`TextExtractionProvider` (the only implementation) does `buffer.toString("utf8")` — it is a stub for a real PDF/OCR provider. `defaultDocumentAnalysisProvider` is exported as the singleton.

#### `extractionService.ts`
The text-understanding layer. `extractTenderRequirements(input, profile?)` normalizes all input strings (filename + notes + documentText) into one lowercase blob and runs a battery of regex/keyword detectors:

| Function | What it detects |
|---|---|
| `detectDomain` | construction / software / consulting / general, by keyword |
| `extractDeadline` | ISO date (`YYYY-MM-DD`) or European date (`DD/MM/YYYY`) via regex; falls back to sample deadline |
| `extractBudget` | EUR/€ amounts via regex |
| `extractBuyer` | municipality / ministry / agency by keyword |
| `detectRegion` | Kosovo / Albania / North Macedonia by city/country keywords |
| `detectLanguage` | Albanian and English if keywords present |
| `detectSubmissionChannel` | e-Procurement portal or physical submission |
| `extractEligibilityCriteria` | Builds a string[] of criteria sentences from domain + keywords |
| `extractRequiredDocuments` | Matches 8 hard-coded `documentRules` against text; marks each document ready if it appears in `availableDocuments` list or matches a company profile document by tags |
| `extractScoringWeights` | Tries regex like `technical[...]{0,20}(\d{1,3})\s?(?:points|pts|%)` for each of 5 weight categories; falls back to sample weights if total ≠ 100 |

`reviewItems[]` accumulates human-readable warnings when deadline/budget/documents could not be detected from the text.

#### `scoringService.ts`
`buildScoreFactors(tender)` maps each `TenderWeight` to a `ScoreFactor`:
1. Determines which keyword patterns belong to the weight category (e.g. "technical" → `["methodology", "implementation", "timeline", "plan", "technical", "approach"]`).
2. Filters `tender.documents` to those whose names contain any of those patterns.
3. If no documents matched: earns 60% of weight (estimated).
4. If documents matched: `earned = round((readyCount / total) * weight)`.

`computeScore(factors)` sums `earned` values, clamped to 100.

`buildScoreExplanation(score, factors)` generates a human sentence noting strong areas (≥ 80% of weight earned) and weak areas (< 50% of weight earned).

#### `gapAnalysisService.ts`
`buildGapAnalysis(tender)` maps every `TenderDocument` to a `GapAnalysisItem`:
- `status`: `"ready"` if `ready`, `"review"` if `reviewReason` is set, otherwise `"missing"`.
- `severity`: `"Low"` if ready; `"High"` for tax/registration/declaration keywords; `"Medium"` for CV/references or default.
- `reason` / `recommendation`: rule-based strings from the document name.

`buildGapSummary(items)` aggregates totals, groups by owner, sorts blockers by severity descending, and sets `canQualify = (blockers.length === 0)`.

`missingTenderDocuments(tender)` — simple filter for `!document.ready`.

#### `tenderService.ts`
The orchestrator. Three exported functions:

- `getSampleAnalysis()` — clones `sampleTender` and runs `buildAnalysisResult`.
- `analyzeTender(input, profile?)` — delegates to extraction then `buildAnalysisResult`.
- `buildDraft(type, tender, profile?)` — generates one of three draft text blocks. Calls `retrieveContext` with a concatenation of `tender.title + tender.criteria` to pull matched company documents and capabilities, which are appended to the draft as an "evidence block". The three drafts are:
  - **summary**: executive positioning paragraph, evidence block, missing doc risk, recommended positioning.
  - **technical**: three-section approach (discovery, implementation, support) with evidence woven in.
  - **team**: role descriptions (PM, architect, QA lead) with evidence, and a reminder about missing CVs.

#### `data/sampleTender.ts`
Hard-coded fixture for "Municipal Digital Services Platform" (Municipality of Prishtina, EUR 240,000, deadline 2026-06-03). Used as the fallback and demo tender throughout. Contains 5 weights summing to 100 and 8 documents (4 ready, 4 missing).

---

## Frontend

### Layout (`app/layout.tsx`)
Standard Next.js root layout. Sets `<html lang="en">`, renders `children` in `<body>`. Sets document metadata: title "TenderPilot", description "Tender analysis and bid drafting workspace". Imports `globals.css`.

### Page (`app/page.tsx`)
A single `"use client"` React component — the entire application lives here. No routing, no separate component files. ~523 lines.

**State:**

| State variable | Type | Purpose |
|---|---|---|
| `analysis` | `AnalysisResult \| null` | Current tender analysis result |
| `draft` | `string` | Generated bid draft text |
| `loading` | `boolean` | Controls "Loading..." panel visibility |
| `selectedFile` | `File \| null` | User-selected PDF file |
| `uploadError` | `string \| null` | Upload error message |
| `profile` | `CompanyProfile \| null` | Company profile from API |
| `profileDescription` | `string` | Editable copy of profile description |
| `profileSaving` | `boolean` | Save-in-progress flag |
| `newDocName/Category/Description/Tags` | `string` | Form state for adding a company document |
| `addingDoc` | `boolean` | Add-document-in-progress flag |

**Derived state:**
- `tender = analysis?.tender` — aliased for convenience.
- `readyCount = useMemo(...)` — count of ready documents in current tender; recomputes when `tender` changes.

**API interactions (all `fetch` calls):**

| Function | Endpoint | Description |
|---|---|---|
| `loadSample()` | `GET /api/tenders/sample` | Loads demo analysis on mount |
| `loadProfile()` | `GET /api/company/profile` | Loads company profile on mount; silently swallows errors |
| `saveProfileDescription()` | `POST /api/company/profile` | Merges edited description into full profile object and PUTs it back |
| `addProfileDocument()` | `POST /api/company/profile/documents` | Posts form fields; reloads profile after |
| `analyzeExample()` | `POST /api/tenders/analyze` | Sends a hard-coded demo payload for quick testing |
| `analyzeUploadedFile()` | `POST /api/tenders/analyze-file` | Multipart upload of selected PDF + notes |
| `createDraft(type)` | `POST /api/bids/draft` | Requests a draft of the given type using current tender |

`useEffect` on mount: calls `loadSample()` and `loadProfile()` in parallel.

**API base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000"`.

**UI structure (JSX layout):**

```
<main class="page">          // CSS Grid: 300px sidebar | 1fr workspace
  <aside class="sidebar">
    Brand logo ("TP")
    Textarea: company description + "Save profile" button
    File input (PDF/DOCX accept) + "Analyze tender" button
    "Load sample" button
    "Analyze demo tender" button
  </aside>

  <section class="workspace">
    <header>  headline text  </header>

    {loading && <div>Loading...</div>}

    {profile && (
      Company Profile panel
        - Name, doc count badge
        - Description (muted)
        - Capabilities (pill tags)
        - Document list (name + category badge + description)
        - "Add company document" form
          (name input | category select | description input | tags input | "Add document" button)
    )}

    {analysis && (
      Metrics strip (4 cards: Score | Risk | Ready docs | Missing)

      Score breakdown panel
        - scoreExplanation text
        - Per-factor: label | earned/weight badge | progress bar | reason

      2-column grid:
        - Tender info card (title, buyer, deadline, budget, channel)
        - Eligibility card (criteria list)

      [Extraction review panel — only if reviewItems.length > 0]

      Compliance checklist panel
        - Per-document row: name | owner | Ready/Missing badge

      Gap analysis panel
        - canQualify badge (green "Can qualify" / red "Blocked")
        - qualificationMessage
        - 4-stat summary (Ready | Review | Missing | High blockers)
        - Top 4 blockers list (name, owner/severity, recommendation)
        - Owner breakdown grid (per-owner: ready / review / missing counts)
        - Full gap item list (per-document: name, owner/severity, status badge, reason, recommendation)

      Bid drafts panel
        - 3 buttons: "Executive summary" | "Technical approach" | "Team qualifications"
        - Editable textarea showing the generated draft
    )}
  </section>
</main>
```

---

### Styling (`app/globals.css`)

No CSS framework — fully custom CSS variables + vanilla rules.

**Design tokens (`:root`):**

| Variable | Value | Use |
|---|---|---|
| `--bg` | `#f5f6f1` | Page background (off-white/green tint) |
| `--surface` | `#ffffff` | Card/panel backgrounds |
| `--ink` | `#17211e` | Primary text |
| `--muted` | `#65716d` | Secondary/label text |
| `--line` | `#dce1d9` | Borders |
| `--accent` | `#0d7c66` | Buttons, progress bars (teal/green) |
| `--dark` | `#12201d` | Sidebar background |
| `--danger` | `#b33a3a` | Missing/error states |
| `--ok` | `#14854b` | Ready/success states |

**Layout:** `.page` uses `grid-template-columns: 300px minmax(0, 1fr)`. At ≤ 900px, a media query collapses everything to `1fr`.

**Notable classes:**

| Class | Purpose |
|---|---|
| `.sidebar` | Dark column, flex column, 24px padding |
| `.brand` | Flex row with logo box (gold `#e8c55e` background) |
| `.metrics` | 4-column grid of KPI cards |
| `.grid` | 2-column grid (tender info + eligibility) |
| `.panel` | White card with border and 18px padding |
| `.panel-title` | Flex row: heading left, pill badge right |
| `.score-bar` / `.score-bar-fill` | Progress bar, 6px tall, `transition: width 0.3s ease` |
| `.check-item` | 3-column grid row: name | owner | status badge |
| `.gap-item` | 2-column grid with full-width `p` and `small` |
| `.gap-summary` | 4-column mini-KPI grid |
| `.owner-grid` | 3-column grid of per-owner stat cards |
| `.blocker-item` | Bordered card with muted recommendation text |
| `.profile-doc` | Document row with name + category badge |
| `.profile-cap` | Pill chip for capabilities |
| `.status-ok` / `.status-off` | Green/red badge overrides for qualify status |
| `.ready` / `.missing` / `.review` | Color classes: green / red / amber |

---

## End-to-End Data Flow

### Flow 1: Initial page load (demo mode)
```
Browser mounts → useEffect fires
  → GET /api/tenders/sample
      → getSampleAnalysis()
          → cloneTender(sampleTender)
          → buildAnalysisResult(tender, "Demo data")
              → buildGapAnalysis(tender)   → GapAnalysisItem[]
              → buildScoreFactors(tender)  → ScoreFactor[]
              → computeScore(factors)      → number
              → buildScoreExplanation(...)
              → deadlineRisk(deadline)
              → missingTenderDocuments(tender)
              → buildGapSummary(gapAnalysis)
      → AnalysisResult JSON
  → setAnalysis(data) → full UI renders

  → GET /api/company/profile
      → getProfile() → clone of in-memory CompanyProfile
  → setProfile(data), setProfileDescription(data.description) → profile panel renders
```

### Flow 2: PDF upload and analysis
```
User selects PDF → selectedFile state set
User clicks "Analyze tender"
  → POST /api/tenders/analyze-file (multipart: file + notes)
      → request.file() → validates PDF, size ≤ 20 MB
      → defaultDocumentAnalysisProvider.analyzeDocument(buffer, name, mime)
          → buffer.toString("utf8") [stub — no real PDF parsing]
      → analyzeTender({ fileName, fileSize, documentText, notes }, getProfile())
          → extractTenderRequirements(input, profile)
              → normalize all text into one lowercase blob
              → keyword/regex detection for deadline, budget, buyer, region, language, channel
              → match documentRules against text → TenderDocument[] with ready flags from profile
              → extractScoringWeights → TenderWeight[]
              → build TenderProfile
          → buildAnalysisResult(extractedTender, source, reviewItems)
      → AnalysisResult JSON
  → setAnalysis(data)
```

### Flow 3: Draft generation
```
User clicks "Executive summary"
  → createDraft("summary")
  → POST /api/bids/draft { type: "summary", tender: currentTender }
      → buildDraft("summary", tender, getProfile())
          → retrieveContext(tender.title + criteria.join(" "))
              → substring-match company docs tags/name against tender text
              → substring-match capabilities
          → assemble draft string with evidence block
      → { type: "summary", draft: "..." }
  → setDraft(data.draft) → textarea renders draft
```

### Flow 4: Company profile update
```
User edits description → profileDescription state updated
User clicks "Save profile"
  → saveProfileDescription()
  → POST /api/company/profile { ...profile, description: newDescription }
      → setProfile(body) on server (in-memory only)
  → loadProfile() to re-sync
```

---

## Key Design Decisions and Specificities

### No database
All state lives in a module-level `currentProfile` variable. Restarting the server resets the company profile to the "Demo Company" fixture. Tender analysis results are never persisted.

### No real PDF parsing
`documentAnalysisService.ts` contains only a stub (`buffer.toString("utf8")`). Actual PDF text extraction (e.g. via pdfjs-dist or an external API) is not yet implemented. Uploaded PDF files will produce garbled text from binary content.

### RAG via substring matching
`retrieveContext` is a keyword-search RAG simulation. It lowercases the tender text and checks if any tag or capability substring appears in it. There are no embeddings, no vector store, no semantic similarity — purely lexical.

### Types duplicated between frontend and backend
`src/types.ts` and `frontend/app/page.tsx` both define identical `TenderDocument`, `TenderProfile`, `ScoreFactor`, `AnalysisResult`, `CompanyDocument`, `CompanyProfile` types. There is no shared package or code generation.

### Single-page frontend
The entire UI (`page.tsx`, 523 lines) is one React component with flat state. No routing, no context, no external state management, no component extraction.

### Permissive CORS
`origin: true` allows any origin to call the backend API. Suitable for local development / hackathon but not production.

### Hard-coded demo data
`sampleTender.ts` is a specific fixture for a Municipality of Prishtina digital platform tender. It drives demo mode and is also used as a fallback template when extraction fails.

### Scoring is document-readiness based
Scores are computed entirely from which tender documents are marked `ready: true`. The algorithm finds documents matching each scoring weight category by keyword, then calculates earned/total. If no documents map to a category, 60% is assumed.

### Gap analysis severity is name-keyword based
Severity (High / Medium / Low) is determined by whether the document name contains keywords like "tax", "registration", "declaration" (High) or "cv", "references" (Medium). Ready documents are always Low severity.

### No authentication
No auth on any endpoint. The API is fully open.

---

## Running the Application

**Backend:**
```bash
npm run dev           # tsx watch src/server.ts on port 3000
```

**Frontend:**
```bash
npm run dev:frontend  # next dev -H 127.0.0.1 -p 3001
```

**Frontend → Backend:** The frontend calls `http://127.0.0.1:3000` by default (configurable via `NEXT_PUBLIC_API_BASE_URL`). Both run on localhost during development.

---

## Current Limitations / Known Gaps

1. **PDF text extraction is a stub** — binary PDF buffers decoded as UTF-8 will not produce meaningful tender text.
2. **No persistence** — company profile and any analysis results are lost on server restart.
3. **No semantic matching** — RAG context retrieval is pure string inclusion; it will miss synonyms and paraphrases.
4. **Types not shared** — type drift between frontend and backend is a maintenance risk.
5. **Single component frontend** — no routing, no component decomposition; will be hard to scale.
6. **No input validation** — Fastify routes accept raw body without schema validation; type assertions are done on the frontend with `as T` casts.
7. **CORS is fully open** — acceptable for hackathon, not for production.
8. **Score extraction regex is fragile** — pattern like `technical[...]{0,20}(\d{1,3})\s?(?:points|pts|%)` will miss many real tender formats.
9. **Deadline detection** — only two date formats (ISO and European); many tender PDFs use long-form dates.
10. **File format UI says "PDF or DOCX"** — the backend rejects anything that is not a PDF; DOCX is not supported.
