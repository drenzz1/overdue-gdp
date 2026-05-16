# TenderPilot — Deep Codebase Research Report

**Date**: 2026-05-16  
**Scope**: `/frontend/app/` and `/src/` (full recursive read)

---

## 1. Project Identity

**TenderPilot** is an AI-powered tender analysis and bid-drafting workspace targeting Kosovo and Balkan public procurement. The core promise: upload a raw tender PDF or DOCX, get an instant compliance score, gap analysis, and AI-written bid sections — all personalised to the company's stored profile.

Stack at a glance:

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Turbopack) |
| Backend | Fastify 5 (TypeScript, tsx watch) |
| AI | Google Gemini via Vertex AI (`@google/genai`) |
| File parsing | mammoth (DOCX), Gemini OCR (PDF) |
| DOCX generation | `docx` npm library |
| Persistence | JSON file (company profile), in-memory Map (generated docs) |
| DB | None (no ORM queries active despite Prisma in deps) |

---

## 2. Repository Layout

```
overdue-gdp/
├── frontend/app/          # Next.js App Router pages and components
│   ├── layout.tsx         # Root layout, metadata
│   ├── page.tsx           # Main page — orchestrates all 4 wizard steps
│   ├── globals.css        # Full design system (CSS variables + utility classes)
│   └── components/
│       ├── StepProfile.tsx    # Step 1: Company profile editor
│       ├── StepUpload.tsx     # Step 2: File upload + analysis trigger
│       ├── StepAnalysis.tsx   # Step 3: Analysis dashboard
│       └── StepDocuments.tsx  # Step 4: Document generation & download
│
└── src/
    ├── server.ts              # Fastify entry point
    ├── app.ts                 # Plugin registration (CORS, multipart, routes)
    ├── types.ts               # All shared TypeScript types
    ├── data/
    │   ├── company-profile.json   # Persisted company profile (mutable)
    │   └── sampleTender.ts        # Hardcoded demo tender
    ├── routes/
    │   ├── healthRoutes.ts        # GET /health
    │   ├── companyRoutes.ts       # GET/POST /api/company/profile[/documents]
    │   ├── tenderRoutes.ts        # POST /api/tenders/analyze-file, /api/bids/draft
    │   └── documentsRoutes.ts     # POST /api/documents/generate, GET /api/documents/download/:id
    └── services/
        ├── companyProfileService.ts    # Profile CRUD + RAG context retrieval
        ├── geminiService.ts            # AI calls (generateText, generateJson, PDF extract)
        ├── documentAnalysisService.ts  # DOCX/PDF text extraction
        ├── extractionService.ts        # Tender requirement parsing (AI + keyword fallback)
        ├── tenderService.ts            # Main analysis orchestrator
        ├── scoringService.ts           # Weighted scoring engine
        ├── gapAnalysisService.ts       # Gap analysis + severity classification
        └── documentGenerationService.ts # Full doc generation + .docx assembly
```

---

## 3. Frontend — Deep Dive

### 3.1 `page.tsx` — The Wizard Orchestrator

The root page is a client component that owns all global state and drives the 4-step wizard. Nothing is rendered server-side except the HTML shell.

**State tree:**

```
step: 1 | 2 | 3 | 4
profile: CompanyProfile | null
analysis: AnalysisResult | null
profileLoading: boolean
```

**Navigation rules (enforced in sidebar):**

- Step 1: Always accessible.
- Step 2: Accessible if `step >= 1`.
- Step 3 & 4: Only accessible after an `analysis` object exists.
- Users can jump backward freely; forward jumps are gated.

**Lifecycle:** On mount, fires `GET /api/company/profile` to hydrate `profile` state. This feeds into the sidebar's "profile summary" chip and pre-populates form fields in StepProfile.

**Layout:** CSS Grid — 280 px sidebar fixed left, fluid workspace right. Collapses to single column below 900 px.

---

### 3.2 `StepProfile.tsx` — Company Identity Editor

Allows editing the persisted company profile (name, description, capabilities, document registry).

**Capabilities** are managed as a string array with an input buffer (`capInput`). Add is validated to prevent empty strings and exact duplicates. Remove is O(n) filter.

**Documents** (certifications, CVs, references, etc.) are added via a mini-form with fields: name, category (enum), description, and comma-separated tags. On submit, a `POST /api/company/profile/documents` fires and the component re-fetches the profile.

**Profile save** (`POST /api/company/profile`) validates that `name` is non-empty client-side before sending.

---

### 3.3 `StepUpload.tsx` — File Upload & Analysis Trigger

Accepts `.pdf` or `.docx` only (validated by MIME type on the `<input>`). Optional freetext notes field (pre-filled with company description). Clicking "Analyze Tender with AI" fires a `multipart/form-data` POST to `/api/tenders/analyze-file`.

**Progressive status UX:** A 5-message array cycles every 2 s while loading:

1. Uploading document…
2. Extracting text with AI…
3. Analyzing requirements…
4. Comparing against your profile…
5. Building compliance report…

The interval is cleared on response (success or error). On success, calls `onAnalyzed(data)` which sets `analysis` in the parent and advances to step 3.

---

### 3.4 `StepAnalysis.tsx` — Analysis Dashboard

The heaviest component. Renders in sections conditionally:

| Section | Condition | Data source |
|---|---|---|
| Simplified summary | `analysis.simplifiedSummary` present | Gemini-generated |
| Key metrics (4 cards) | Always | score, deadlineRisk, docs counts |
| Score breakdown | Always | `scoreBreakdown[]` |
| Tender details | Always | `tender` object |
| Extraction notes | `reviewItems.length > 0` | AI flagged warnings |
| Compliance checklist | Always | `tender.documents[]` |
| Gap analysis | Always | `gapAnalysis[]`, `gapSummary` |
| Bid drafts | Always | Generated on demand |

**Bid draft sub-workflow:** Three buttons (Executive Summary, Technical Approach, Team Qualifications) each trigger `POST /api/bids/draft` with `{ type, tender }`. Response fills an editable textarea. Only one draft can be in-flight at a time (single `draftLoading` state).

---

### 3.5 `StepDocuments.tsx` — Document Generation

Renders a card grid for every tender document plus 3 virtual bid draft sections. Each card is independently stateful:

- `generating: Set<name>` — tracks in-progress generation per card.
- `downloading: Set<name>` — tracks download in progress.
- `generatedDocs: Map<name, GeneratedDoc>` — stores content + id after generation.
- `errors: Map<name, string>` — per-card error display.

**Generate flow:** `POST /api/documents/generate` → response stores `{ id, content }` in map → displays editable textarea.

**Download flow:** `GET /api/documents/download/{id}` → binary .docx response → creates a blob URL → programmatic `<a>` click → cleanup.

A progress counter (`X of Y generated`) is derived from `generatedDocs.size / totalDocs`.

---

### 3.6 `globals.css` — Design System

CSS custom properties define the whole palette:

```css
--accent:  #0d7c66   /* teal — primary brand */
--dark:    #12201d   /* near-black background */
--ok:      #14854b   /* green — ready/success */
--warn:    #9a6400   /* amber — review/warning */
--danger:  #b33a3a   /* red — missing/high severity */
--muted:   #65716d   /* grey — secondary text */
```

Component classes follow a BEM-adjacent flat naming convention (`.wizard-nav`, `.score-factor`, `.gap-item`, `.doc-card`, etc.). No CSS framework — entirely hand-written.

---

## 4. Backend — Deep Dive

### 4.1 Server Startup

`server.ts` imports `createApp()` from `app.ts` and calls `fastify.listen({ port, host })`. `app.ts` registers plugins:

1. `@fastify/cors` — `origin: true` (allows all origins; suitable for local dev, not production).
2. `@fastify/multipart` — 20 MB file limit, 1 file per request.
3. Four route plugins (health, company, tender, documents).

---

### 4.2 Type System (`types.ts`)

All cross-layer contracts are defined here. Key types:

- **`TenderProfile`** — extracted tender metadata (title, buyer, region, deadline, value, language, channel, criteria[], weights[], documents[]).
- **`TenderDocument`** — per-document compliance record (name, owner, ready, evidence?, reviewReason?).
- **`AnalysisResult`** — the full payload returned to the frontend (tender, source, score, scoreBreakdown[], scoreExplanation, deadlineRisk, missingDocuments[], gapAnalysis[], gapSummary, reviewItems[], simplifiedSummary?).
- **`CompanyProfile`** — company name, description, capabilities[], documents[].
- **`GapAnalysisItem`** — per-document gap record (documentName, owner, status, severity, reason, recommendation, evidence?).
- **`SimplifiedSummary`** — three AI-generated bullet arrays (whatYouNeedToWin, winningFactors, topRisks).
- **`GeneratedDocument`** — output of doc generation (id, documentName, content, generatedAt).

---

### 4.3 Routes

#### Health (`GET /health`)
Returns `{ status: "ok", service: "tenderpilot-api" }`. Used by frontend/infra to confirm the server is alive.

#### Company Profile (`/api/company/profile`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/company/profile` | Read current profile |
| POST | `/api/company/profile` | Overwrite profile (name required) |
| POST | `/api/company/profile/documents` | Append a document (name + category required) |

Document IDs are auto-generated from `Date.now()` if not provided.

#### Tenders & Bids

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tenders/sample` | Demo analysis (no file needed) |
| POST | `/api/tenders/analyze` | Analyze with pre-extracted text |
| POST | `/api/tenders/analyze-file` | Upload PDF/DOCX and analyze |
| POST | `/api/bids/draft` | Generate one bid draft section |

`/api/tenders/analyze-file` is the main entry point. It:
1. Validates MIME type (pdf or docx only).
2. Buffers the uploaded file.
3. Calls `documentAnalysisService` to extract text.
4. Passes text + notes to `tenderService.analyzeTender()`.
5. Returns the full `AnalysisResult`.

`/api/bids/draft` validates the `type` field against `["summary", "technical", "team"]`, returns 400 on invalid type and 429 on AI rate limit.

#### Documents

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/documents/generate` | Generate document content (returns id + content) |
| GET | `/api/documents/download/:id` | Download stored .docx by id |

Generated documents are stored in an in-memory `Map`. No TTL mechanism — they persist until server restart.

---

### 4.4 Service Layer

#### `companyProfileService.ts`

Reads/writes `src/data/company-profile.json` on every mutation (synchronous `fs.writeFileSync`). Profile is loaded into a module-level variable at startup. All reads return a deep clone.

Key function: **`retrieveContext(tenderText)`** — the RAG step. It:
1. Lowercases the tender text.
2. Matches each company document's `tags[]` and `name` against the text (substring search).
3. Filters company `capabilities[]` by keyword matches against the text.
4. Returns `{ matchedDocuments, relevantCapabilities }` — this context is injected into AI prompts for bid generation.

#### `geminiService.ts`

Wraps the Gemini Vertex AI SDK (`@google/genai`). The module exposes:

- `generateText(prompt, systemInstruction?)` — max 1024 tokens, temperature 0.4, 3-retry with exponential backoff (2 s, 4 s, 8 s) on rate limit.
- `generateJson(prompt)` — max 4096 tokens, temperature 0.2, JSON mode enforced.
- `generateTextFromPdf(pdfBase64, prompt)` — max 4096 tokens, temperature 0.2.
- `extractJsonFromResponse(text)` — strips markdown code fences, finds `{…}` envelope.

`hasGemini` boolean gates all AI features. When false, the system runs entirely on keyword/template fallbacks.

#### `documentAnalysisService.ts`

Implements the `DocumentAnalysisProvider` interface with two providers:

1. **`TextExtractionProvider`** — no-op fallback, decodes buffer as UTF-8.
2. **`GeminiDocumentAnalysisProvider`** — DOCX via mammoth, PDF via Gemini base64 OCR prompt.

`defaultDocumentAnalysisProvider` selects Gemini provider if `hasGemini`, else fallback.

#### `extractionService.ts`

The most complex service. Two paths:

**AI path (`extractWithGemini`):**
- Sends the full document text and the company profile to Gemini.
- Instructs strict JSON output with the full `TenderProfile` schema plus `simplifiedSummary` and `reviewItems`.
- Validates that weights sum to 100 (resets to sample weights if not).
- Documents are marked `ready: true` only if the company profile has matching evidence.
- Falls back to sample tender fields for any missing values.

**Keyword fallback (`keywordExtract`):**
- Domain detection: construction | software | consulting | general.
- Deadline extraction: ISO or European date patterns.
- Budget extraction: EUR amount patterns.
- Buyer, region, language, channel detection via keyword arrays.
- 8 document templates (registration, tax, financial, references, CVs, declarations, methodology, pricing) each with keyword arrays and owner assignments.
- 5 scoring weight categories with keyword patterns.
- Generates `reviewItems[]` flagging every inferred value.

#### `tenderService.ts`

Top-level orchestrator called by routes. Key function `analyzeTender(input, profile?)`:

1. If no `fileName` → returns sample analysis.
2. Calls `extractionService.extractTenderRequirements()`.
3. Calls `scoringService.buildScoreFactors()` and `computeScore()`.
4. Calls `gapAnalysisService.buildGapAnalysis()` and `buildGapSummary()`.
5. Computes `deadlineRisk` (High ≤7 days, Medium ≤21 days, Low otherwise).
6. Assembles and returns `AnalysisResult`.

`buildDraft(type, tender, profile?)` tries Gemini first, falls back to template strings.

Gemini draft prompts are tightly specified per type:
- **summary**: 200-250 words, positioning + alignment + strengths + why choose us.
- **technical**: 350-450 words, discovery / compliance / implementation / support.
- **team**: 250-300 words, roles + experience + comparable projects.

#### `scoringService.ts`

Maps tender `weights[]` labels to document name patterns:

| Category pattern | Keywords matched |
|---|---|
| Technical | methodology, implementation, timeline, plan, technical, approach |
| Experience | reference, experience, comparable |
| Team | cv, curriculum, manager, architect, lead, qualification |
| Price | price, financial, offer, cost, budget, pricing |
| Support | support, maintenance, service |

For each weight factor: `earned = (readyCount / totalCount) * weight`. Default 60 % if no documents match the category. Score = sum of all earned points, capped at 100.

#### `gapAnalysisService.ts`

Maps each `TenderDocument` to a `GapAnalysisItem`:

- **Status**: `ready` if `doc.ready === true`, else `review` if `doc.reviewReason` present, else `missing`.
- **Severity**: `High` for tax/registration/declarations, `Medium` for CVs/references, `Low` for ready docs.
- **Recommendation**: Template strings keyed by document name patterns.
- **`buildGapSummary`**: Aggregates by owner, identifies blockers, sets `canQualify = blockers.length === 0`.

#### `documentGenerationService.ts`

`generateDocumentContent(documentName, tender, profile)`:
1. Builds a contextual Gemini prompt (company name, description, capabilities, documents on file, tender value/deadline/language/criteria, document-type-specific instructions).
2. Instructs markdown formatting (`#`, `##`, `-` bullets) and `[PLACEHOLDER: …]` for unknown data.
3. Calls `generateText()`.
4. Calls `assembleDocx()` to convert markdown-ish text to a `.docx` buffer.
5. Stores `{ doc, docxBuffer }` in memory `Map<id, …>`.
6. Returns `GeneratedDocument`.

`assembleDocx(title, content)`:
- Line-by-line parser: `# ` → Heading 1, `## ` → Heading 2, `- ` → bullet list item, else Paragraph.
- Uses `docx.Packer.toBuffer()` for final binary output.

---

## 5. End-to-End Data Flow

```
User uploads tender PDF/DOCX
         │
         ▼
POST /api/tenders/analyze-file
         │
         ├─► documentAnalysisService
         │       DOCX: mammoth.extractRawText()
         │       PDF:  Gemini OCR (base64)
         │       → extractedText
         │
         ├─► extractionService.extractTenderRequirements(text, profile)
         │       AI path:  Gemini JSON prompt → TenderProfile
         │       Fallback: keyword heuristics → TenderProfile
         │       → { tender, reviewItems, simplifiedSummary }
         │
         ├─► scoringService.buildScoreFactors(tender)
         │       → ScoreFactor[] + total score
         │
         ├─► gapAnalysisService.buildGapAnalysis(tender)
         │       → GapAnalysisItem[] + GapAnalysisSummary
         │
         └─► Returns AnalysisResult to frontend
                  │
                  ▼
         StepAnalysis renders dashboard
                  │
                  ├─► "Generate Draft" button
                  │       POST /api/bids/draft
                  │       → tenderService.buildDraft()
                  │       → Gemini or template text
                  │
                  └─► StepDocuments
                          POST /api/documents/generate
                          → documentGenerationService
                          → Gemini content + assembleDocx()
                          → stored in memory Map
                          GET /api/documents/download/:id
                          → returns .docx binary
```

---

## 6. RAG Implementation

The RAG pipeline is simple but functional:

1. **Corpus**: Company profile documents (3–N items, each with name, category, description, tags[]).
2. **Retrieval**: `companyProfileService.retrieveContext(tenderText)` does substring matching — tags and document names against lowercased tender text. Capabilities are filtered similarly.
3. **Augmentation**: Matched documents and capabilities are injected into all Gemini prompts for bid drafts and document generation.
4. **Limitation**: No vector embeddings, no semantic similarity — purely lexical. Works well for domain-specific keyword-rich procurement texts but will miss semantic matches (e.g., "cloud infrastructure" vs. "IaaS").

---

## 7. Notable Design Decisions & Specifics

### Persistence
- Company profile: file-backed (`company-profile.json`) — survives restarts.
- Generated documents: in-memory only — lost on restart, no TTL.
- Analysis results: never persisted — re-run required after restart.

### AI Fallbacks
Every AI-dependent feature has a graceful fallback:
- Text extraction: raw UTF-8 decode.
- Tender parsing: keyword heuristics.
- Bid drafts: template strings with company name injected.
- Document generation: no fallback (returns 500 if Gemini unavailable).

### File Handling
- Max upload: 20 MB.
- Accepted: `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Validation: MIME type checked first, file extension as fallback.
- DOCX text extraction uses mammoth (no AI cost); PDF uses Gemini OCR.

### Scoring
Scores are deterministic once extraction is complete — no AI call. Pure arithmetic on `(readyCount / totalCount) * weight` per category. This makes scores reproducible for the same extracted tender.

### Document Generation Storage
Generated `.docx` buffers are kept in a module-level `Map`. There is no eviction policy. Long-running servers will accumulate memory. The download endpoint returns 404 after a server restart because the map is empty.

### CORS
Backend configured with `origin: true` (reflects any origin). Fine for local development and internal hackathon use; should be restricted to the frontend domain in production.

### Prisma
`@prisma/client` is listed as a dependency but no Prisma queries or schema files are present in the codebase. This is vestigial — the project was scaffolded with it but never connected a database.

---

## 8. API Contract Summary

| Endpoint | Method | Auth | Body | Response |
|---|---|---|---|---|
| `/health` | GET | None | — | `{ status, service }` |
| `/api/company/profile` | GET | None | — | `CompanyProfile` |
| `/api/company/profile` | POST | None | `CompanyProfile` | `{ ok: true }` |
| `/api/company/profile/documents` | POST | None | `Omit<CompanyDocument, 'id'>` | `{ ok, document }` |
| `/api/tenders/sample` | GET | None | — | `AnalysisResult` |
| `/api/tenders/analyze` | POST | None | `AnalyzeTenderInput` | `AnalysisResult` |
| `/api/tenders/analyze-file` | POST | None | multipart (file + notes?) | `AnalysisResult` |
| `/api/bids/draft` | POST | None | `{ type, tender? }` | `{ type, draft }` |
| `/api/documents/generate` | POST | None | `{ documentName, tender, companyProfile? }` | `GeneratedDocument` |
| `/api/documents/download/:id` | GET | None | — | `.docx` binary |

---

## 9. Identified Gaps & Risks

| Area | Issue | Impact |
|---|---|---|
| Generated doc storage | No TTL or eviction on memory Map | Memory leak on long-running server |
| RAG quality | Lexical-only matching (no embeddings) | Poor recall on semantic mismatches |
| PDF extraction | Relies entirely on Gemini OCR | Fails if Gemini quota exceeded |
| No auth | All endpoints open | Fine for hackathon, risk in production |
| CORS `origin: true` | Allows any origin | CSRF risk if cookies were used |
| Prisma dep unused | Dead dependency | Adds install weight, confuses readers |
| Document generation fallback | None — 500 if Gemini down | Blocks step 4 entirely |
| Company profile write | `fs.writeFileSync` on every save | Blocks event loop momentarily |
| In-memory analysis results | Not persisted | User must re-upload after restart |

---

## 10. Summary

TenderPilot is a well-structured, single-purpose application. The architecture is clean — thin routes, fat services, shared types. The 4-step wizard maps directly to the procurement workflow: profile → upload → analyze → export. AI is used at every stage where it adds value and every path has a fallback. The main production risks are the in-memory document store, lexical RAG, and missing auth — all expected trade-offs for a hackathon-origin project.
