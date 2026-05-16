import { sampleTender } from "../data/sampleTender.js";
import { extractJsonFromResponse, geminiFlash, hasGemini } from "./geminiService.js";
import type { AnalyzeTenderInput, CompanyProfile, SimplifiedSummary, TenderDocument, TenderProfile, TenderWeight } from "../types.js";

export type ExtractionOutput = {
  tender: TenderProfile;
  simplifiedSummary?: SimplifiedSummary;
  reviewItems: string[];
};

// ─── Gemini extraction ────────────────────────────────────────────────────────

async function extractWithGemini(
  documentText: string,
  fileName: string | undefined,
  profile: CompanyProfile | undefined
): Promise<ExtractionOutput> {
  const profileJson = profile
    ? JSON.stringify({ name: profile.name, description: profile.description, capabilities: profile.capabilities, documents: profile.documents.map((d) => ({ name: d.name, tags: d.tags, description: d.description })) }, null, 2)
    : "{}";

  const prompt = `You are a public procurement expert specializing in Kosovo and Balkan public tenders.

Analyze the following tender document and extract all requirements.
Also compare them against the company profile to determine document readiness.

Company profile:
${profileJson}

Tender document:
${documentText}

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "title": "string — full tender title",
  "buyer": "string — contracting authority name",
  "region": "string — country or region (e.g. Kosovo, Albania)",
  "deadline": "string — format YYYY-MM-DD HH:mm CET, or 'Not specified'",
  "value": "string — contract value, e.g. EUR 240,000 or 'Not specified'",
  "language": "string — required submission language(s)",
  "channel": "string — submission channel (e-Procurement portal, physical, etc.)",
  "criteria": ["string — each eligibility requirement as a clear sentence"],
  "weights": [{"label": "string", "value": number}],
  "documents": [
    {
      "name": "string — document name",
      "owner": "Finance or Sales or Delivery or Legal",
      "ready": true or false,
      "evidence": "string or omit if not ready",
      "reviewReason": "string or omit if ready"
    }
  ],
  "simplifiedSummary": {
    "whatYouNeedToWin": ["plain language bullet — specific action or requirement to win"],
    "winningFactors": ["key differentiator that scores highest"],
    "topRisks": ["biggest risk or blocker to qualification"]
  },
  "reviewItems": ["warning about missing or ambiguous data extracted from tender"]
}

Rules:
- weights must sum to 100; if you cannot determine them, use: [{"label":"Technical","value":35},{"label":"Experience","value":25},{"label":"Team","value":20},{"label":"Price","value":15},{"label":"Support","value":5}]
- For documents: set ready=true only if the company profile clearly has evidence for it
- Include 5–10 documents based on what the tender explicitly requires
- whatYouNeedToWin: 4–6 bullets, plain language, actionable
- winningFactors: 3–4 items (highest-weighted criteria)
- topRisks: 3–4 items (missing docs, tight deadline, capability gaps)
- Do NOT include null values — omit optional fields instead`;

  const result = await geminiFlash.generateContent(prompt);
  const raw = extractJsonFromResponse(result.response.text());

  const parsed = JSON.parse(raw) as {
    title?: string;
    buyer?: string;
    region?: string;
    deadline?: string;
    value?: string;
    language?: string;
    channel?: string;
    criteria?: string[];
    weights?: Array<{ label: string; value: number }>;
    documents?: Array<{
      name?: string;
      owner?: string;
      ready?: boolean;
      evidence?: string;
      reviewReason?: string;
    }>;
    simplifiedSummary?: SimplifiedSummary;
    reviewItems?: string[];
  };

  const weights = validateWeights(parsed.weights);
  const documents = buildDocuments(parsed.documents ?? []);

  const tender: TenderProfile = {
    title: parsed.title ?? titleFromFileName(fileName),
    buyer: parsed.buyer ?? "Public contracting authority",
    region: parsed.region ?? sampleTender.region,
    deadline: parsed.deadline && parsed.deadline !== "Not specified" ? parsed.deadline : sampleTender.deadline,
    value: parsed.value && parsed.value !== "Not specified" ? parsed.value : sampleTender.value,
    language: parsed.language ?? sampleTender.language,
    channel: parsed.channel ?? sampleTender.channel,
    criteria: parsed.criteria?.length ? parsed.criteria : sampleTender.criteria,
    weights,
    documents: documents.length ? documents : fallbackDocuments()
  };

  return {
    tender,
    reviewItems: parsed.reviewItems ?? [],
    ...(parsed.simplifiedSummary ? { simplifiedSummary: parsed.simplifiedSummary } : {})
  };
}

function validateWeights(raw: Array<{ label: string; value: number }> | undefined): TenderWeight[] {
  if (!raw?.length) return sampleTender.weights.map((w) => ({ ...w }));
  const total = raw.reduce((s, w) => s + w.value, 0);
  if (total === 100) return raw;
  return sampleTender.weights.map((w) => ({ ...w }));
}

function buildDocuments(raw: Array<{ name?: string; owner?: string; ready?: boolean; evidence?: string; reviewReason?: string }>): TenderDocument[] {
  return raw
    .filter((d) => d.name)
    .map((d) => {
      const ready = d.ready === true;
      const doc: TenderDocument = {
        name: d.name!,
        owner: d.owner ?? "Delivery",
        ready
      };
      if (ready && d.evidence) doc.evidence = d.evidence;
      if (!ready && d.reviewReason) doc.reviewReason = d.reviewReason;
      return doc;
    });
}

function fallbackDocuments(): TenderDocument[] {
  return sampleTender.documents.map((d) => ({
    ...d,
    ready: false,
    reviewReason: "Default requirement; verify against original tender document."
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractTenderRequirements(
  input: AnalyzeTenderInput,
  profile?: CompanyProfile
): Promise<ExtractionOutput> {
  if (hasGemini && input.documentText) {
    try {
      return await extractWithGemini(input.documentText, input.fileName, profile);
    } catch {
      // fall through to keyword fallback
    }
  }

  return keywordExtract(input, profile);
}

// ─── Keyword fallback (retained for demo / no-API-key mode) ──────────────────

const documentRules: Array<{ name: string; owner: string; keywords: string[] }> = [
  { name: "Business registration certificate", owner: "Finance", keywords: ["business registration", "company registration", "registration certificate"] },
  { name: "Tax compliance certificate", owner: "Finance", keywords: ["tax compliance", "tax certificate", "tax clearance"] },
  { name: "Comparable project references", owner: "Sales", keywords: ["references", "similar projects", "comparable projects", "previous experience"] },
  { name: "Delivery team CVs", owner: "Delivery", keywords: ["cv", "cvs", "team qualifications", "key experts", "project manager"] },
  { name: "Implementation methodology", owner: "Delivery", keywords: ["methodology", "technical approach", "implementation plan"] },
  { name: "Financial offer template", owner: "Finance", keywords: ["financial offer", "price offer", "bill of quantities", "price table"] },
  { name: "Signed declarations", owner: "Legal", keywords: ["declaration", "signed statement", "conflict of interest"] },
  { name: "24-month maintenance price table", owner: "Finance", keywords: ["24-month", "maintenance", "support period"] }
];

const weightRules: Array<{ label: string; keywords: string[]; value: number }> = [
  { label: "Technical methodology", keywords: ["technical", "methodology", "technical approach"], value: 35 },
  { label: "Relevant experience", keywords: ["experience", "references", "similar projects"], value: 25 },
  { label: "Team qualifications", keywords: ["team", "cv", "experts", "qualifications"], value: 20 },
  { label: "Price", keywords: ["price", "financial", "cost"], value: 15 },
  { label: "Support plan", keywords: ["support", "maintenance"], value: 5 }
];

function keywordExtract(input: AnalyzeTenderInput, profile?: CompanyProfile): ExtractionOutput {
  const text = normalize([input.fileName, input.notes, input.documentText].filter(Boolean).join("\n"));
  const reviewItems: string[] = [];
  const domain = detectDomain(text);
  const deadline = extractDeadline(text);
  const value = extractBudget(text) ?? defaultBudget(domain);
  const documents = extractRequiredDocuments(text, input.availableDocuments, profile);
  const weights = extractScoringWeights(text);

  if (!deadline.detected) reviewItems.push("Submission deadline was not found in the supplied text; using demo deadline for review.");
  if (!extractBudget(text)) reviewItems.push("Tender value was not found in the supplied text; budget is marked as estimated or to be confirmed.");
  if (documents.some((d) => d.reviewReason)) reviewItems.push("Some required documents were inferred from tender keywords and should be verified against the original PDF.");

  return {
    tender: {
      ...cloneTender(sampleTender),
      title: titleFromFileName(input.fileName),
      buyer: extractBuyer(text),
      region: detectRegion(text),
      deadline: deadline.value,
      value,
      language: detectLanguage(text),
      channel: detectSubmissionChannel(text),
      criteria: extractEligibilityCriteria(text, domain),
      weights,
      documents
    },
    reviewItems
  };
}

function normalize(value: string) { return value.toLowerCase().replace(/\s+/g, " ").trim(); }

function cloneTender(tender: TenderProfile): TenderProfile {
  return { ...tender, criteria: [...tender.criteria], weights: tender.weights.map((w) => ({ ...w })), documents: tender.documents.map((d) => ({ ...d })) };
}

function titleFromFileName(fileName: string | undefined) {
  if (!fileName) return "Uploaded tender";
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded tender";
}

function detectDomain(text: string) {
  if (containsAny(text, ["construction", "infrastructure", "road", "building", "works"])) return "construction";
  if (containsAny(text, ["software", "platform", "digital", "system", "cloud", "portal"])) return "software";
  if (containsAny(text, ["consulting", "consultancy", "training", "advisory"])) return "consulting";
  return "general";
}

function extractDeadline(text: string) {
  const isoDate = text.match(/\b20\d{2}[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  const europeanDate = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  const time = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? "14:00";
  if (isoDate?.[0]) return { value: `${isoDate[0].replace(/[/.]/g, "-")} ${time} CET`, detected: true };
  if (europeanDate?.[1] && europeanDate[2] && europeanDate[3]) {
    const [, day, month, year] = europeanDate;
    return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${time} CET`, detected: true };
  }
  return { value: sampleTender.deadline, detected: false };
}

function extractBudget(text: string) {
  const match = text.match(/\b(?:eur|euro|€)\s?[\d,.]+(?:\s?(?:k|m|million))?\b/);
  if (!match) return undefined;
  return match[0].replace(/^euro/i, "EUR").replace(/^eur/i, "EUR").replace(/^€/i, "EUR ");
}

function defaultBudget(domain: string) {
  if (domain === "construction") return "EUR 520,000";
  if (domain === "software") return "EUR 240,000";
  return "To be confirmed";
}

function extractBuyer(text: string) {
  if (containsAny(text, ["municipality", "komuna"])) return "Municipality procurement office";
  if (containsAny(text, ["ministry", "ministria"])) return "Ministry procurement office";
  if (containsAny(text, ["agency", "authority"])) return "Public agency procurement office";
  return "Public contracting authority";
}

function detectRegion(text: string) {
  if (containsAny(text, ["kosovo", "prishtina", "pristina", "prizren", "peja"])) return "Kosovo";
  if (containsAny(text, ["albania", "tirana"])) return "Albania";
  if (containsAny(text, ["north macedonia", "skopje"])) return "North Macedonia";
  return sampleTender.region;
}

function detectLanguage(text: string) {
  if (containsAny(text, ["albanian", "english", "shqip", "anglisht"])) return "Albanian and English";
  return sampleTender.language;
}

function detectSubmissionChannel(text: string) {
  if (containsAny(text, ["e-procurement", "e procurement", "electronic procurement", "portal"])) return "e-Procurement portal";
  if (containsAny(text, ["sealed envelope", "physical submission"])) return "Physical submission";
  return sampleTender.channel;
}

function extractEligibilityCriteria(text: string, domain: string) {
  const criteria = new Set<string>();
  if (containsAny(text, ["registration", "registered company"])) criteria.add("Company registration certificate is mandatory.");
  if (containsAny(text, ["tax compliance", "tax clearance"])) criteria.add("Tax compliance certificate must be submitted.");
  if (containsAny(text, ["references", "similar projects", "previous experience"])) criteria.add("Comparable project references are required for eligibility and scoring.");
  if (containsAny(text, ["cv", "team", "key expert", "project manager"])) criteria.add("Named delivery team CVs and role allocation must be included.");
  if (containsAny(text, ["financial offer", "price offer", "price table"])) criteria.add("Financial offer must follow the tender template exactly.");
  if (domain === "construction") criteria.add("Construction references and site safety documentation should be included.");
  else criteria.add("Implementation methodology must address delivery plan, risks, and support.");
  return [...criteria];
}

function extractRequiredDocuments(text: string, availableDocuments: string[] = [], profile?: CompanyProfile): TenderDocument[] {
  const available = normalize(availableDocuments.join(" "));
  const profileDocs = profile?.documents ?? [];

  const documents = documentRules
    .filter((rule) => containsAny(text, rule.keywords))
    .map((rule) => {
      const readyByAvailable = containsAny(available, [rule.name, ...rule.keywords]);
      const matchingProfileDoc = profileDocs.find((doc) => containsAny(normalize([doc.name, ...doc.tags].join(" ")), [rule.name, ...rule.keywords]));
      const ready = readyByAvailable || Boolean(matchingProfileDoc);
      const evidence = matchingProfileDoc ? `Company profile: ${matchingProfileDoc.description}` : readyByAvailable ? "Matched against available company documents." : undefined;
      const doc: TenderDocument = { name: rule.name, owner: rule.owner, ready };
      if (evidence) doc.evidence = evidence;
      if (!ready) doc.reviewReason = "Required by tender keywords, not found in company profile or available documents.";
      return doc;
    });

  if (documents.length) return documents;
  return sampleTender.documents.map((d) => ({ ...d, ready: false, reviewReason: "Default requirement; verify against original tender document." }));
}

function extractScoringWeights(text: string): TenderWeight[] {
  const explicitWeights = weightRules.map((rule) => {
    const keywordPattern = rule.keywords.join("|");
    const regex = new RegExp(`(?:${keywordPattern})[^0-9]{0,20}(\\d{1,3})\\s?(?:points|pts|%)`, "i");
    const match = text.match(regex);
    return { label: rule.label, value: match?.[1] ? Number(match[1]) : rule.value };
  });
  const total = explicitWeights.reduce((s, w) => s + w.value, 0);
  if (total === 100) return explicitWeights;
  return sampleTender.weights.map((w) => ({ ...w }));
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k.toLowerCase()));
}
