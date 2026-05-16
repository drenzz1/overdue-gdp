import { sampleTender } from "../data/sampleTender.js";
import { retrieveContext } from "./companyProfileService.js";
import { extractTenderRequirements } from "./extractionService.js";
import { geminiFlashText, hasGemini } from "./geminiService.js";
import { buildGapAnalysis, buildGapSummary, missingTenderDocuments } from "./gapAnalysisService.js";
import { buildScoreExplanation, buildScoreFactors, computeScore } from "./scoringService.js";
import type { AnalysisResult, AnalyzeTenderInput, CompanyProfile, DraftType, TenderDocument, TenderProfile } from "../types.js";

function cloneTender(tender: TenderProfile): TenderProfile {
  return {
    ...tender,
    criteria: [...tender.criteria],
    weights: tender.weights.map((w) => ({ ...w })),
    documents: tender.documents.map((d) => ({ ...d }))
  };
}

function formatSource(fileName: string | undefined, fileSize: number | undefined) {
  if (!fileName) return "Demo data";
  if (!fileSize) return fileName;
  return `${fileName} - ${(fileSize / 1024).toFixed(1)} KB`;
}

export function getSampleAnalysis(): AnalysisResult {
  return buildAnalysisResult(cloneTender(sampleTender), "Demo data");
}

export async function analyzeTender(input: AnalyzeTenderInput, profile?: CompanyProfile): Promise<AnalysisResult> {
  if (!input.fileName) {
    return getSampleAnalysis();
  }

  const extraction = await extractTenderRequirements(input, profile);
  const result = buildAnalysisResult(
    extraction.tender,
    formatSource(input.fileName, input.fileSize),
    extraction.reviewItems
  );

  if (extraction.simplifiedSummary) {
    result.simplifiedSummary = extraction.simplifiedSummary;
  }

  return result;
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

export async function buildDraft(type: DraftType, tender: TenderProfile, profile?: CompanyProfile): Promise<string> {
  if (hasGemini && profile) {
    try {
      return await buildDraftWithGemini(type, tender, profile);
    } catch {
      // fall through to template fallback
    }
  }
  return buildDraftTemplate(type, tender, profile);
}

async function buildDraftWithGemini(type: DraftType, tender: TenderProfile, profile: CompanyProfile): Promise<string> {
  const { matchedDocuments, relevantCapabilities } = retrieveContext([tender.title, ...tender.criteria].join(" "));
  const evidenceLines = [
    ...matchedDocuments.map((d) => `- ${d.name}: ${d.description}`),
    ...relevantCapabilities.map((c) => `- Capability: ${c}`)
  ].join("\n");

  const missing = missingDocuments(tender).map((d) => d.name).join(", ") || "none";

  const sectionDescriptions: Record<DraftType, { name: string; length: string; instructions: string }> = {
    summary: {
      name: "Executive Summary",
      length: "200–250 words",
      instructions: "Write a compelling executive summary positioning the company as the ideal partner. Highlight alignment with tender requirements, key strengths, and commitment to delivery. End with a clear statement of why this company should be chosen."
    },
    technical: {
      name: "Technical Approach",
      length: "350–450 words",
      instructions: "Write a structured technical approach with three clear sections: (1) Discovery & Compliance Mapping, (2) Implementation Plan, (3) Support & Maintenance. Reference specific tender criteria and scoring weights. Show methodology alignment."
    },
    team: {
      name: "Team Qualifications",
      length: "250–300 words",
      instructions: "Describe the proposed delivery team. Include roles: Project Manager, Solution Architect, QA Lead. Describe each role's accountability and relevant experience. Reference comparable projects where possible."
    }
  };

  const section = sectionDescriptions[type];

  const prompt = `You are a professional bid writer with expertise in public procurement in Kosovo and the Balkans.

Write the "${section.name}" section of a tender bid response.
Target length: ${section.length}.
Instructions: ${section.instructions}

Company: ${profile.name}
Company description: ${profile.description}
Capabilities: ${profile.capabilities.join(", ")}

Company evidence matched to this tender:
${evidenceLines || "No specific evidence matched — write based on company description."}

Tender: ${tender.title}
Buyer: ${tender.buyer} (${tender.region})
Value: ${tender.value}
Deadline: ${tender.deadline}
Language: ${tender.language}
Scoring weights: ${tender.weights.map((w) => `${w.label} (${w.value}%)`).join(", ")}

Key criteria:
${tender.criteria.map((c) => `- ${c}`).join("\n")}

Documents still missing: ${missing}

Write professional, specific prose. Do not use placeholder text or generic statements. Be concrete about what this company will deliver.`;

  const result = await geminiFlashText.generateContent(prompt);
  return result.response.text().trim();
}

function buildDraftTemplate(type: DraftType, tender: TenderProfile, profile?: CompanyProfile): string {
  const missing = missingDocuments(tender).map((d) => d.name);
  const missingText = missing.length ? missing.join(", ") : "no missing documents";

  let profileDescription = "Regional delivery team with relevant implementation experience.";
  let evidenceBlock = "";

  if (profile) {
    profileDescription = profile.description.trim() || profileDescription;
    const { matchedDocuments, relevantCapabilities } = retrieveContext([tender.title, ...tender.criteria].join(" "));
    const lines = [
      ...matchedDocuments.map((d) => `- ${d.name}: ${d.description}`),
      ...relevantCapabilities.map((c) => `- Capability on file: ${c}`)
    ];
    if (lines.length) evidenceBlock = `\n\nRelevant company evidence:\n${lines.join("\n")}`;
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
