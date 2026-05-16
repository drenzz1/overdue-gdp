import type { GapAnalysisItem, GapAnalysisSummary, TenderDocument, TenderProfile } from "../types.js";

export function buildGapAnalysis(tender: TenderProfile): GapAnalysisItem[] {
  return tender.documents.map((document) => ({
    documentName: document.name,
    owner: document.owner,
    status: document.ready ? "ready" : document.reviewReason ? "review" : "missing",
    severity: severityForDocument(document),
    reason: reasonForDocument(document),
    recommendation: recommendationForDocument(document),
    ...(document.evidence ? { evidence: document.evidence } : {})
  }));
}

export function missingTenderDocuments(tender: TenderProfile): TenderDocument[] {
  return tender.documents.filter((document) => !document.ready);
}

export function buildGapSummary(items: GapAnalysisItem[]): GapAnalysisSummary {
  const ownerMap = new Map<string, { owner: string; ready: number; missing: number; review: number }>();

  for (const item of items) {
    const current = ownerMap.get(item.owner) ?? {
      owner: item.owner,
      ready: 0,
      missing: 0,
      review: 0
    };

    if (item.status === "ready") current.ready += 1;
    if (item.status === "missing") current.missing += 1;
    if (item.status === "review") current.review += 1;
    ownerMap.set(item.owner, current);
  }

  const readyDocuments = items.filter((item) => item.status === "ready").length;
  const missingDocuments = items.filter((item) => item.status === "missing").length;
  const reviewDocuments = items.filter((item) => item.status === "review").length;
  const blockers = items
    .filter((item) => item.status !== "ready")
    .sort((first, second) => severityRank(second.severity) - severityRank(first.severity))
    .map((item) => ({
      documentName: item.documentName,
      owner: item.owner,
      severity: item.severity,
      recommendation: item.recommendation
    }));
  const highSeverityBlockers = blockers.filter((item) => item.severity === "High").length;
  const canQualify = blockers.length === 0;

  return {
    totalDocuments: items.length,
    readyDocuments,
    missingDocuments,
    reviewDocuments,
    highSeverityBlockers,
    canQualify,
    qualificationMessage: qualificationMessage(canQualify, highSeverityBlockers, blockers.length),
    ownerBreakdown: [...ownerMap.values()].sort((first, second) => first.owner.localeCompare(second.owner)),
    blockers
  };
}

function severityForDocument(document: TenderDocument): GapAnalysisItem["severity"] {
  const name = document.name.toLowerCase();
  if (document.ready) return "Low";
  if (name.includes("tax") || name.includes("registration") || name.includes("declaration")) return "High";
  if (name.includes("cv") || name.includes("references")) return "Medium";
  return "Medium";
}

function reasonForDocument(document: TenderDocument) {
  if (document.ready) {
    return "Document appears to be available in the company evidence set.";
  }

  return document.reviewReason ?? "Document is required for a compliant tender submission but is not marked as ready.";
}

function recommendationForDocument(document: TenderDocument) {
  if (document.ready) return "Attach the document to the bid package and confirm it is still valid.";

  const name = document.name.toLowerCase();
  if (name.includes("tax")) return "Request an up-to-date tax compliance certificate before submission.";
  if (name.includes("registration")) return "Add the latest business registration certificate to the company profile.";
  if (name.includes("references")) return "Select comparable projects and prepare signed reference summaries.";
  if (name.includes("cv")) return "Collect current CVs for named delivery team members.";
  if (name.includes("financial") || name.includes("price")) return "Complete the required financial offer template.";
  if (name.includes("declaration")) return "Prepare and sign all required legal declarations.";
  return "Assign an owner and upload the document before final bid export.";
}

function severityRank(severity: GapAnalysisItem["severity"]) {
  if (severity === "High") return 3;
  if (severity === "Medium") return 2;
  return 1;
}

function qualificationMessage(canQualify: boolean, highSeverityBlockers: number, blockerCount: number) {
  if (canQualify) {
    return "All required documents are marked ready. The bid package can proceed to final review.";
  }

  if (highSeverityBlockers > 0) {
    return `You have ${highSeverityBlockers} high-severity blocker${highSeverityBlockers === 1 ? "" : "s"} that may prevent qualification.`;
  }

  return `You have ${blockerCount} document${blockerCount === 1 ? "" : "s"} that need review before submission.`;
}
