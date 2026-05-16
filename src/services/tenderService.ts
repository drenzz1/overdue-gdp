import { sampleTender } from "../data/sampleTender.js";
import { extractTenderRequirements } from "./extractionService.js";
import { buildGapAnalysis, buildGapSummary, missingTenderDocuments } from "./gapAnalysisService.js";
import { generateText } from "./geminiService.js";
import { buildScoreExplanation, buildScoreFactors, computeScore } from "./scoringService.js";
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

export async function buildDraft(type: DraftType, tender: TenderProfile, companyProfile = ""): Promise<string> {
  const missing = missingDocuments(tender).map((document) => document.name);
  const missingText = missing.length ? missing.join(", ") : "none";
  const profile = companyProfile.trim() || "Regional delivery team with relevant implementation experience.";

  const context = `Tender title: ${tender.title}
Buyer: ${tender.buyer}
Region: ${tender.region}
Deadline: ${tender.deadline}
Value: ${tender.value}
Language requirements: ${tender.language}
Submission channel: ${tender.channel}
Eligibility criteria: ${tender.criteria.join("; ")}
Missing documents: ${missingText}
Company profile: ${profile}`;

  const prompts: Record<DraftType, string> = {
    summary: `You are a bid writing expert. Write a professional executive summary for a public tender bid.
Use the tender details below to write a concise, compelling summary (3-4 paragraphs) that positions the company as the best choice.
Address compliance risks from missing documents and highlight strengths. Write in formal English.

${context}`,
    technical: `You are a bid writing expert. Write a detailed technical approach section for a public tender bid.
Use the tender details below. Cover: discovery and requirements mapping, implementation methodology, delivery milestones, testing, training, and post-go-live support.
Be specific to this tender. Write in formal English. Use numbered sections.

${context}`,
    team: `You are a bid writing expert. Write a team qualifications section for a public tender bid.
Use the tender details below. Describe the key roles needed (project manager, solution architect, QA lead, and any domain-specific roles relevant to this tender).
For each role state responsibilities and what experience should be demonstrated. End with a note on CV and reference requirements.
Write in formal English.

${context}`
  };

  return generateText(prompts[type]);
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
