import { sampleTender } from "../data/sampleTender.js";
import { retrieveContext } from "./companyProfileService.js";
import { extractTenderRequirements } from "./extractionService.js";
import { buildGapAnalysis, buildGapSummary, missingTenderDocuments } from "./gapAnalysisService.js";
import { buildScoreExplanation, buildScoreFactors, computeScore } from "./scoringService.js";
import type { AnalysisResult, AnalyzeTenderInput, CompanyProfile, DraftType, TenderDocument, TenderProfile } from "../types.js";

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

export function analyzeTender(input: AnalyzeTenderInput, profile?: CompanyProfile): AnalysisResult {
  if (!input.fileName) {
    return getSampleAnalysis();
  }

  const extraction = extractTenderRequirements(input, profile);
  return buildAnalysisResult(extraction.tender, formatSource(input.fileName, input.fileSize), extraction.reviewItems);
}

export function scoreTender(tender: TenderProfile): number {
  return computeScore(buildScoreFactors(tender));
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

export function buildDraft(type: DraftType, tender: TenderProfile, profile?: CompanyProfile | string) {
  const missing = missingDocuments(tender).map((document) => document.name);
  const missingText = missing.length ? missing.join(", ") : "no missing documents";

  let profileDescription: string;
  let evidenceBlock = "";

  if (typeof profile === "object" && profile !== null) {
    profileDescription = profile.description.trim() || "Regional delivery team with relevant implementation experience.";
    const tenderContext = [tender.title, ...tender.criteria].join(" ");
    const { matchedDocuments, relevantCapabilities } = retrieveContext(tenderContext);
    const lines: string[] = [];
    for (const doc of matchedDocuments) lines.push(`- ${doc.name}: ${doc.description}`);
    for (const cap of relevantCapabilities) lines.push(`- Capability on file: ${cap}`);
    if (lines.length) evidenceBlock = `\n\nRelevant company evidence:\n${lines.join("\n")}`;
  } else {
    profileDescription =
      (typeof profile === "string" ? profile.trim() : "") ||
      "Regional delivery team with relevant implementation experience.";
  }

  const drafts: Record<DraftType, string> = {
    summary: `${tender.buyer}
${tender.title}

We propose a compliant, delivery-focused response for ${tender.title}, built around clear governance, practical implementation milestones, and measurable service outcomes. Our company profile matches the tender's core needs: ${profileDescription}${evidenceBlock}

The bid should emphasize comparable references, bilingual delivery capacity, and a support model aligned with the requested ${tender.language} documentation requirements. Current compliance risk is concentrated in: ${missingText}.

Recommended positioning: low-risk regional partner with strong implementation discipline and rapid public-sector onboarding.`,
    technical: `Technical approach

1. Discovery and compliance mapping
We will confirm all functional, legal, and submission requirements with ${tender.buyer}, then maintain a traceability matrix that maps every tender requirement to the relevant bid response, document, or delivery artifact.${evidenceBlock}

2. Implementation
The delivery plan covers discovery, configuration, integrations, migration, user acceptance testing, training, and go-live support. Workstreams will be managed through weekly checkpoints, issue logs, and acceptance criteria tied to the tender's scoring model.

3. Support
The support model includes a 24-month maintenance period, incident triage, release management, knowledge transfer, and bilingual documentation for operational continuity.`,
    team: `Team qualifications

Project manager: accountable for governance, buyer communication, reporting, and milestone control.

Solution architect: accountable for platform design, integration decisions, security alignment, and technical quality gates.

QA lead: accountable for test planning, acceptance evidence, defect management, and release readiness.${evidenceBlock}

The team should attach CVs, role allocation, availability, and short proof points from at least three comparable projects. Missing CVs should be resolved before submission to avoid eligibility failure.`
  };

  return drafts[type];
}

function buildAnalysisResult(tender: TenderProfile, source: string, reviewItems: string[] = []): AnalysisResult {
  const gapAnalysis = buildGapAnalysis(tender);
  const scoreBreakdown = buildScoreFactors(tender);
  const score = computeScore(scoreBreakdown);

  return {
    tender,
    source,
    score,
    scoreBreakdown,
    scoreExplanation: buildScoreExplanation(score, scoreBreakdown),
    deadlineRisk: deadlineRisk(tender.deadline),
    missingDocuments: missingDocuments(tender),
    gapAnalysis,
    gapSummary: buildGapSummary(gapAnalysis),
    reviewItems
  };
}
