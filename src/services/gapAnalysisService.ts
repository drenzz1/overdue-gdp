import type { GapAnalysisItem, TenderDocument, TenderProfile } from "../types.js";

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
