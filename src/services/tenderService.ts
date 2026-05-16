import { sampleTender } from "../data/sampleTender.js";
import { extractTenderRequirements } from "./extractionService.js";
import { buildGapAnalysis, missingTenderDocuments } from "./gapAnalysisService.js";
import type { AnalysisResult, AnalyzeTenderInput, DraftType, TenderDocument, TenderProfile } from "../types.js";

function cloneTender(tender: TenderProfile): TenderProfile {
  return {
    ...tender,
    criteria: [...tender.criteria],
    weights: tender.weights.map((weight) => ({ ...weight })),
    documents: tender.documents.map((document) => ({ ...document }))
  };
}

function titleFromFileName(fileName: string | undefined) {
  if (!fileName) return "Uploaded tender";
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded tender";
}

function formatSource(fileName: string | undefined, fileSize: number | undefined) {
  if (!fileName) return "Demo data";
  if (!fileSize) return fileName;
  return `${fileName} - ${(fileSize / 1024).toFixed(1)} KB`;
}

export function getSampleAnalysis(): AnalysisResult {
  return buildAnalysisResult(cloneTender(sampleTender), "Demo data");
}

export function analyzeTender(input: AnalyzeTenderInput): AnalysisResult {
  if (!input.fileName) {
    return getSampleAnalysis();
  }

  const extraction = extractTenderRequirements(input);
  return buildAnalysisResult(extraction.tender, formatSource(input.fileName, input.fileSize), extraction.reviewItems);
}

export function scoreTender(tender: TenderProfile) {
  const ready = tender.documents.filter((document) => document.ready).length;
  const total = tender.documents.length || 1;
  const complianceScore = Math.round((ready / total) * 45);
  const experienceBoost = tender.criteria.some((item) => item.toLowerCase().includes("reference")) ? 7 : 4;
  return Math.min(96, 38 + complianceScore + experienceBoost);
}

export function deadlineRisk(deadline: string): AnalysisResult["deadlineRisk"] {
  const date = new Date(deadline.replace(" CET", "+01:00"));
  if (Number.isNaN(date.getTime())) return "Medium";

  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 7) return "High";
  if (days <= 21) return "Medium";
  return "Low";
}

export function missingDocuments(tender: TenderProfile): TenderDocument[] {
  return missingTenderDocuments(tender);
}

export function buildDraft(type: DraftType, tender: TenderProfile, companyProfile = "") {
  const missing = missingDocuments(tender).map((document) => document.name);
  const missingText = missing.length ? missing.join(", ") : "no missing documents";
  const profile = companyProfile.trim() || "Regional delivery team with relevant implementation experience.";

  const drafts: Record<DraftType, string> = {
    summary: `${tender.buyer}
${tender.title}

We propose a compliant, delivery-focused response for ${tender.title}, built around clear governance, practical implementation milestones, and measurable service outcomes. Our company profile matches the tender's core needs: ${profile}

The bid should emphasize comparable references, bilingual delivery capacity, and a support model aligned with the requested ${tender.language} documentation requirements. Current compliance risk is concentrated in: ${missingText}.

Recommended positioning: low-risk regional partner with strong implementation discipline and rapid public-sector onboarding.`,
    technical: `Technical approach

1. Discovery and compliance mapping
We will confirm all functional, legal, and submission requirements with ${tender.buyer}, then maintain a traceability matrix that maps every tender requirement to the relevant bid response, document, or delivery artifact.

2. Implementation
The delivery plan covers discovery, configuration, integrations, migration, user acceptance testing, training, and go-live support. Workstreams will be managed through weekly checkpoints, issue logs, and acceptance criteria tied to the tender's scoring model.

3. Support
The support model includes a 24-month maintenance period, incident triage, release management, knowledge transfer, and bilingual documentation for operational continuity.`,
    team: `Team qualifications

Project manager: accountable for governance, buyer communication, reporting, and milestone control.

Solution architect: accountable for platform design, integration decisions, security alignment, and technical quality gates.

QA lead: accountable for test planning, acceptance evidence, defect management, and release readiness.

The team should attach CVs, role allocation, availability, and short proof points from at least three comparable projects. Missing CVs should be resolved before submission to avoid eligibility failure.`
  };

  return drafts[type];
}

function buildAnalysisResult(tender: TenderProfile, source: string, reviewItems: string[] = []): AnalysisResult {
  return {
    tender,
    source,
    score: scoreTender(tender),
    deadlineRisk: deadlineRisk(tender.deadline),
    missingDocuments: missingDocuments(tender),
    gapAnalysis: buildGapAnalysis(tender),
    reviewItems
  };
}
