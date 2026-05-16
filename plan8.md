# TenderPilot — Full Demo Flow Implementation Plan

**Goal**: Gjirafa Tek has a complete, pre-loaded profile with every document type a public tender requires. When they upload a real tender PDF or DOCX, the AI compares it against the company's actual documents, produces an accurate compliance analysis, and generates all required bid documents ready for download.

**Scope**: Company data, backend services. No new endpoints, no mock data, no architectural changes — surgical fixes only.

---

## Current State vs Target State

| Area | Current | Target |
|---|---|---|
| Company profile | `company-profile.json` — empty capabilities and documents arrays | 10 documents, 8 capabilities covering every procurement document type |
| AI tender analysis | Profile context is empty → AI marks all docs `ready: false` | Rich profile → AI marks docs `ready: true` where evidence matches |
| Token limit | `generateText` hardcoded at 1024 — methodology docs get cut off | Parameterized; document generation uses 2048 |
| RAG context | Tag-only substring matching | Matches tags, document name, and description keywords |
| Document generation | Generic prompt, no document-type instructions | Type-specific instructions per document category |

---

## Phase 1 — Rich Demo Company Profile

**File**: `src/data/company-profile.json`

**Why**: This JSON is injected into every AI prompt — extraction, bid drafts, document generation. With empty `capabilities` and `documents` arrays, the AI has no evidence to compare against tender requirements, so every document defaults to `ready: false`. Filling it out with all standard procurement document types is the single highest-leverage change.

The tags are deliberately aligned with the keyword arrays inside `extractionService.ts` (lines 166–174) and the `documentRules` list, so the keyword fallback path also benefits.

**Replace the entire file**:

```json
{
  "name": "Gjirafa Tek",
  "description": "Gjirafa Tek is a Prishtina-based technology company with 22 engineers specialising in software development, cloud infrastructure, public sector digital transformation, system integrations, e-Procurement platforms, data-driven services, cybersecurity, and bilingual (Albanian/English) delivery. The company has delivered platforms for central and local government bodies across Kosovo and the region, with a proven track record in public procurement compliance, agile project delivery, and post-go-live maintenance.",
  "capabilities": [
    "software development and web platform delivery",
    "cloud infrastructure and DevOps on AWS and Azure",
    "public sector system integrations and e-Procurement portals",
    "Albanian and English technical documentation and training",
    "agile implementation with discovery, migration, UAT, and support phases",
    "cybersecurity auditing and compliance for public sector clients",
    "data platform development and analytics dashboards",
    "24-month managed support and SLA-backed maintenance contracts"
  ],
  "documents": [
    {
      "id": "doc-1",
      "name": "Business registration certificate",
      "category": "legal",
      "description": "Gjirafa Tek SH.P.K. is registered with the Kosovo Business Registration Agency (KBRA), registration number 811234567, valid and current. Certificate available in Albanian and English.",
      "tags": ["business registration", "company registration", "registration certificate", "legal", "KBRA", "sh.p.k"]
    },
    {
      "id": "doc-2",
      "name": "Tax compliance certificate",
      "category": "legal",
      "description": "Certificate of tax compliance issued by the Kosovo Tax Administration (ATK), confirming Gjirafa Tek is current on all VAT, corporate income tax, and social contributions. Valid for the current fiscal year.",
      "tags": ["tax compliance", "tax certificate", "tax clearance", "ATK", "fiscal compliance", "VAT"]
    },
    {
      "id": "doc-3",
      "name": "Reference 1 — Kosovo e-Procurement Portal (PPRC)",
      "category": "reference",
      "description": "Delivered the national e-Procurement portal for the Public Procurement Regulatory Commission of Kosovo (PPRC). Project value EUR 320,000. Covered discovery, platform build, data migration from legacy system, bilingual training for 400+ contracting authority users, and 12-month post-go-live support.",
      "tags": ["references", "comparable projects", "previous experience", "similar projects", "e-procurement", "public sector", "government", "portal"]
    },
    {
      "id": "doc-4",
      "name": "Reference 2 — Ministry of Finance Digital Services Platform",
      "category": "reference",
      "description": "End-to-end delivery of a citizen digital services platform for the Ministry of Finance of Kosovo. Project value EUR 210,000. Integrated with national ID registry, payment gateway, and municipal databases. Albanian and English interfaces. 18-month support contract.",
      "tags": ["references", "comparable projects", "previous experience", "similar projects", "digital services", "government platform", "ministry", "public sector"]
    },
    {
      "id": "doc-5",
      "name": "Reference 3 — Municipality of Gjakova Smart City Dashboard",
      "category": "reference",
      "description": "Delivered a real-time smart city operations dashboard for the Municipality of Gjakova. Project value EUR 85,000. Covered IoT data ingestion, analytics dashboards, mobile app, and staff training. 24-month SLA maintenance contract included.",
      "tags": ["references", "comparable projects", "previous experience", "similar projects", "municipality", "smart city", "dashboard", "public sector"]
    },
    {
      "id": "doc-6",
      "name": "Project manager CV — Artan Krasniqi",
      "category": "cv",
      "description": "PMP-certified Project Manager with 10 years of experience in public sector IT delivery in Kosovo and Albania. Managed 12 government platform projects. Fluent in Albanian and English. Has led teams of up to 15 engineers. Currently available for full project assignment.",
      "tags": ["cv", "project manager", "curriculum vitae", "key experts", "team qualifications", "PMP", "project management", "cvs"]
    },
    {
      "id": "doc-7",
      "name": "Solution architect CV — Rina Berisha",
      "category": "cv",
      "description": "AWS Certified Solution Architect with 8 years of experience designing scalable web platforms and government system integrations. Designed architecture for 5 public sector platforms. Expertise in microservices, API gateways, OAuth2, and GDPR-compliant data handling.",
      "tags": ["cv", "solution architect", "architect", "curriculum vitae", "key experts", "team qualifications", "AWS", "architecture", "cvs"]
    },
    {
      "id": "doc-8",
      "name": "QA lead CV — Blerta Hyseni",
      "category": "cv",
      "description": "ISTQB-certified QA Lead with 6 years of experience in test planning, automated testing, and acceptance evidence for public sector platforms. Led UAT and release readiness for 8 government digital projects. Proficient in Albanian and English test documentation.",
      "tags": ["cv", "QA lead", "quality assurance", "curriculum vitae", "key experts", "team qualifications", "testing", "ISTQB", "cvs"]
    },
    {
      "id": "doc-9",
      "name": "Implementation methodology",
      "category": "capability",
      "description": "Gjirafa Tek's ISO-9001-aligned agile delivery methodology adapted for public sector procurement. Covers four phases: (1) Discovery and Requirements Mapping, (2) Iterative Platform Development with bi-weekly demos, (3) Migration, UAT, and Bilingual Training, (4) Go-Live and 24-month Support. Full traceability matrix and risk register included.",
      "tags": ["methodology", "technical approach", "implementation plan", "delivery plan", "agile", "ISO", "discovery", "migration", "training", "support", "UAT"]
    },
    {
      "id": "doc-10",
      "name": "24-month maintenance and support price table",
      "category": "capability",
      "description": "Standardised 24-month SLA support pricing template: Tier 1 helpdesk response 4h, Tier 2 resolution 48h, Tier 3 escalation 5 days. Includes monthly release cycles, security patches, bilingual documentation updates, and dedicated account manager. Unit pricing per service line available on request.",
      "tags": ["24-month", "maintenance", "support period", "SLA", "maintenance price", "support pricing", "price table", "helpdesk"]
    }
  ]
}
```

---

## Phase 2 — Parameterize Token Limit in `generateText`

**File**: `src/services/geminiService.ts`

**Why**: `generateText` is hardcoded to `max_tokens: 1024` (line 34). Methodology documents (500–800 words) and reference summaries (300–400 words) get cut off mid-sentence at this limit. Adding an optional parameter with a safe default keeps existing callers unchanged.

**Change line 20** — add optional third parameter:

```typescript
// before
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {

// after
export async function generateText(prompt: string, systemInstruction?: string, maxTokens = 1024): Promise<string> {
```

**Change line 34** — use the parameter:

```typescript
// before
        max_tokens: 1024,

// after
        max_tokens: maxTokens,
```

---

## Phase 3 — Increase Token Limit for Document Generation

**File**: `src/services/documentGenerationService.ts`

**Why**: `generateDocumentContent` calls `generateText(prompt)` at line 36, inheriting the 1024-token default. Full bid documents need more headroom.

**Change line 36**:

```typescript
// before
  const content = await generateText(prompt);

// after
  const content = await generateText(prompt, undefined, 2048);
```

---

## Phase 4 — Enrich Document Generation Prompt + Type Instructions

**File**: `src/services/documentGenerationService.ts`

**Why**: The current prompt (lines 12–34) injects document names and descriptions but gives no document-type-specific structure. A methodology document needs four named phases; a CV needs personal details, certifications, and project history; a tax certificate needs different framing entirely. The current generic instruction produces equally generic output for all of them.

Also, the prompt does not surface the specific company document whose evidence matches this request — the AI has to infer it from a flat list.

**Replace the `generateDocumentContent` function and add `documentTypeInstructions`** below it:

```typescript
export async function generateDocumentContent(
  documentName: string,
  tender: TenderProfile,
  profile: CompanyProfile
): Promise<GeneratedDocument> {
  const docContext = profile.documents
    .map((d) => `  - ${d.name} [${d.category}]: ${d.description}`)
    .join("\n");

  const capContext = profile.capabilities.join(", ");

  const matchingDoc = profile.documents.find(
    (d) =>
      d.name.toLowerCase().includes(documentName.toLowerCase().slice(0, 20)) ||
      documentName.toLowerCase().includes(d.name.toLowerCase().slice(0, 20))
  );
  const evidenceNote = matchingDoc
    ? `\nSpecific company evidence for this document: ${matchingDoc.description}`
    : "";

  const typeInstructions = documentTypeInstructions(documentName);

  const prompt = `You are a professional bid document writer with expertise in public procurement in Kosovo and the Balkans.

Generate the complete, submission-ready content for the "${documentName}" document.
This document is for ${profile.name} bidding on "${tender.title}" (${tender.buyer}, ${tender.region}).

## Company Profile
Name: ${profile.name}
Description: ${profile.description}
Capabilities: ${capContext}

Company documents on file:
${docContext}
${evidenceNote}

## Tender Context
Contract value: ${tender.value}
Submission deadline: ${tender.deadline}
Required language: ${tender.language}
Eligibility criteria:
${tender.criteria.map((c) => `  - ${c}`).join("\n")}
Scoring weights:
${tender.weights.map((w) => `  - ${w.label}: ${w.value}%`).join("\n")}

## Document-Specific Instructions
${typeInstructions}

## General Instructions
- Write in formal, professional procurement language
- Do NOT use generic placeholder company names — use ${profile.name} throughout
- Where specific figures cannot be determined, use [PLACEHOLDER: description]
- Structure with clear headings using ## for sections
- Make content specific to both this company and this tender`;

  const content = await generateText(prompt, undefined, 2048);

  const id = `gendoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const docxBuffer = await assembleDocx(documentName, content);

  const doc: GeneratedDocument = {
    id,
    documentName,
    content,
    generatedAt: new Date().toISOString()
  };

  store.set(id, { doc, docxBuffer });
  return doc;
}

function documentTypeInstructions(documentName: string): string {
  const name = documentName.toLowerCase();

  if (name.includes("tax")) {
    return "Write a cover note for the tax compliance certificate. Confirm compliance status, issuing authority (ATK), validity period, and tax categories covered (VAT, corporate income tax, social contributions). 100–150 words.";
  }
  if (name.includes("registration")) {
    return "Write a formal declaration/cover letter presenting the business registration certificate. State company name, registration number, date of registration, and issuing authority (KBRA). Note that the original certificate is appended. 100–150 words.";
  }
  if (name.includes("reference")) {
    return "Write a full project reference summary. For each reference include: client name, project title, contract value, delivery period, scope (3–4 sentences), key outcomes, and client contact details. Format each reference as a separate ## section. 300–400 words total.";
  }
  if (name.includes("cv") || name.includes("curriculum")) {
    return "Write a professional CV. Sections: Personal Details, Role Summary, Key Qualifications and Certifications, Relevant Project Experience (4–6 projects with client name, role, duration, and scope), Technical Skills, Languages. 350–450 words. Use [PLACEHOLDER: full name] if name is unknown.";
  }
  if (name.includes("methodology") || name.includes("implementation") || name.includes("technical approach") || name.includes("timeline")) {
    return "Write a detailed implementation methodology with exactly four sections: ## 1. Discovery and Requirements Mapping, ## 2. Platform Development and Integration, ## 3. Migration, UAT, and Training, ## 4. Go-Live and Support. Each section 150–200 words. Reference the tender's specific scoring criteria. Total 600–800 words.";
  }
  if (name.includes("maintenance") || (name.includes("support") && name.includes("price"))) {
    return "Write a 24-month maintenance and SLA document. Include: ## Service Tiers (Tier 1 helpdesk, Tier 2 technical, Tier 3 escalation), ## Response Time Commitments per tier, ## Included Services (patches, releases, documentation, training updates), ## Pricing Structure (monthly retainer or unit rates with example figures). 300–400 words plus a structured pricing table.";
  }
  if (name.includes("declaration")) {
    return "Write a formal signed declaration covering: no conflict of interest, no blacklisting by any contracting authority, company is not under bankruptcy or liquidation proceedings, all submitted information is accurate and complete. Include a signature block. 150–200 words.";
  }
  if (name.includes("executive summary")) {
    return "Write a compelling executive summary (200–250 words) positioning the company as the ideal partner. Highlight alignment with tender scoring weights, the three strongest capabilities, comparable public sector references, and a clear commitment statement.";
  }
  if (name.includes("financial") || name.includes("price offer") || name.includes("price table")) {
    return "Write a formal financial offer with: cover letter confirming the total bid price, a breakdown by delivery phase (discovery, development, migration/training, support), unit rates for key line items, payment milestone schedule, and VAT treatment. 250–350 words plus a structured price table.";
  }

  return "Write a complete, professional document appropriate for public procurement submission. Use clear ## section headings. Length: 300–500 words appropriate to the document type.";
}
```

---

## Phase 5 — Improve RAG Context Retrieval

**File**: `src/services/companyProfileService.ts`

**Why**: `retrieveContext` (lines 92–106) matches only by exact tag substring and exact document name against the tender text. This misses keywords present in the document `description` field that are not in `tags`. Since bid draft quality scales directly with how many matched documents are returned, broader matching produces noticeably better AI output — especially for capabilities, which are short phrases that may only partially appear in the tender.

**Replace lines 92–106**:

```typescript
export function retrieveContext(tenderText: string): ProfileContext {
  const text = tenderText.toLowerCase();

  const matchedDocuments = currentProfile.documents.filter((doc) => {
    const tagMatch = doc.tags.some((tag) => text.includes(tag.toLowerCase()));
    const nameMatch = text.includes(doc.name.toLowerCase());
    const descWords = doc.description.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    const descMatch = descWords.some((word) => text.includes(word));
    return tagMatch || nameMatch || descMatch;
  });

  const relevantCapabilities = currentProfile.capabilities.filter((cap) => {
    const capWords = cap.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return capWords.some((word) => text.includes(word));
  });

  return { matchedDocuments, relevantCapabilities };
}
```

---

## Phase 6 — Align `sampleTender.ts` with the Company Profile

**File**: `src/data/sampleTender.ts`

**Why**: `getSampleAnalysis()` (`tenderService.ts` line 25) still returns hardcoded documents with 4 marked `ready: false`. This is only hit by `GET /api/tenders/sample` (the old demo endpoint), but it should reflect what Gjirafa Tek actually has in its profile so the score output is consistent.

**Replace the `documents` array**:

```typescript
documents: [
  { name: "Business registration certificate", owner: "Finance", ready: true, evidence: "KBRA registration certificate on file, valid and current." },
  { name: "Tax compliance certificate", owner: "Finance", ready: true, evidence: "ATK tax compliance certificate on file for current fiscal year." },
  { name: "Three project references", owner: "Sales", ready: true, evidence: "Three signed references: PPRC e-Procurement Portal, MoF Digital Services Platform, Gjakova Smart City Dashboard." },
  { name: "Project manager CV", owner: "Delivery", ready: true, evidence: "CV for Artan Krasniqi (PMP, 10 years public sector IT) on file." },
  { name: "Solution architect CV", owner: "Delivery", ready: true, evidence: "CV for Rina Berisha (AWS Certified Solution Architect, 8 years) on file." },
  { name: "QA lead CV", owner: "Delivery", ready: true, evidence: "CV for Blerta Hyseni (ISTQB QA Lead, 6 years) on file." },
  { name: "Implementation timeline", owner: "Delivery", ready: true, evidence: "ISO-9001-aligned agile methodology covering discovery, migration, training, and support on file." },
  { name: "24-month maintenance price table", owner: "Finance", ready: true, evidence: "Standardised SLA pricing template with Tier 1/2/3 support rates on file." }
]
```

---

## Execution Order

| # | Phase | File | Risk |
|---|---|---|---|
| 1 | Rich company profile | `src/data/company-profile.json` | None — data only |
| 2 | Parameterize token limit | `src/services/geminiService.ts` | None — backwards compatible |
| 3 | Increase doc gen tokens | `src/services/documentGenerationService.ts` | None — same function, bigger limit |
| 4 | Enrich doc gen prompt | `src/services/documentGenerationService.ts` | Low — same interface |
| 5 | Improve RAG context | `src/services/companyProfileService.ts` | Low — broader matching, not narrower |
| 6 | Align sample tender | `src/data/sampleTender.ts` | None — data only |
| 7 | Restart backend | — | Server picks up new JSON on boot |

---

## Expected Flow After Implementation

```
User opens TenderPilot
        │
        ▼
Step 1 — Company Profile
  Gjirafa Tek pre-loaded
  10 documents shown (legal, CVs, references, methodology, maintenance)
  8 capabilities listed
        │
        ▼
Step 2 — Upload Real Tender (PDF or DOCX)
  User selects their actual tender file
  POST /api/tenders/analyze-file (multipart)
        │
        ▼
  documentAnalysisService extracts text
    DOCX → mammoth
    PDF  → Gemini OCR
        │
        ▼
  extractionService.extractWithGemini(text, profile)
    AI sees 10 company documents + 8 capabilities
    AI marks tender documents ready=true where company evidence matches
    AI returns structured TenderProfile + simplifiedSummary
        │
        ▼
  scoringService → weighted score
  gapAnalysisService → gap items + summary
  deadlineRisk → Low / Medium / High
        │
        ▼
Step 3 — Analysis Dashboard
  Score: reflects actual company readiness
  Docs ready: count of matched tender requirements
  Gap analysis: specific blockers if any docs are missing
  Simplified summary: AI plain-language what-you-need-to-win
  Bid draft buttons: Executive Summary / Technical Approach / Team
    → buildDraftWithGemini pulls all 10 company docs via retrieveContext
    → rich, evidence-backed draft text
        │
        ▼
Step 4 — Document Generation
  One card per tender document + 3 bid sections
  "Generate Full Draft" → POST /api/documents/generate
    → generateDocumentContent with 2048 tokens
    → type-specific prompt (CV vs methodology vs tax cert etc.)
    → complete submission-ready content in textarea
  User edits if needed
  "Download .docx" → GET /api/documents/download/:id
```

---

## Files Changed

| File | Change |
|---|---|
| `src/data/company-profile.json` | Complete rewrite — 10 documents, 8 capabilities |
| `src/data/sampleTender.ts` | All 8 documents set to `ready: true` with evidence |
| `src/services/geminiService.ts` | Add `maxTokens` parameter to `generateText` |
| `src/services/documentGenerationService.ts` | 2048 tokens; enriched prompt; `documentTypeInstructions()` |
| `src/services/companyProfileService.ts` | Broader `retrieveContext` matching |

**Total**: 5 files edited. No new files. No new dependencies. No new endpoints.
