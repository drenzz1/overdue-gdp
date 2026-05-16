import { sampleTender } from "../data/sampleTender.js";
import type { AnalyzeTenderInput, CompanyProfile, TenderDocument, TenderProfile, TenderWeight } from "../types.js";

type ExtractionOutput = {
  tender: TenderProfile;
  reviewItems: string[];
};

const documentRules: Array<{
  name: string;
  owner: string;
  keywords: string[];
}> = [
  {
    name: "Business registration certificate",
    owner: "Finance",
    keywords: ["business registration", "company registration", "registration certificate"]
  },
  {
    name: "Tax compliance certificate",
    owner: "Finance",
    keywords: ["tax compliance", "tax certificate", "tax clearance"]
  },
  {
    name: "Comparable project references",
    owner: "Sales",
    keywords: ["references", "similar projects", "comparable projects", "previous experience"]
  },
  {
    name: "Delivery team CVs",
    owner: "Delivery",
    keywords: ["cv", "cvs", "team qualifications", "key experts", "project manager"]
  },
  {
    name: "Implementation methodology",
    owner: "Delivery",
    keywords: ["methodology", "technical approach", "implementation plan"]
  },
  {
    name: "Financial offer template",
    owner: "Finance",
    keywords: ["financial offer", "price offer", "bill of quantities", "price table"]
  },
  {
    name: "Signed declarations",
    owner: "Legal",
    keywords: ["declaration", "signed statement", "conflict of interest"]
  },
  {
    name: "24-month maintenance price table",
    owner: "Finance",
    keywords: ["24-month", "maintenance", "support period"]
  }
];

const weightRules: Array<{ label: string; keywords: string[]; value: number }> = [
  { label: "Technical methodology", keywords: ["technical", "methodology", "technical approach"], value: 35 },
  { label: "Relevant experience", keywords: ["experience", "references", "similar projects"], value: 25 },
  { label: "Team qualifications", keywords: ["team", "cv", "experts", "qualifications"], value: 20 },
  { label: "Price", keywords: ["price", "financial", "cost"], value: 15 },
  { label: "Support plan", keywords: ["support", "maintenance"], value: 5 }
];

export function extractTenderRequirements(input: AnalyzeTenderInput, profile?: CompanyProfile): ExtractionOutput {
  const text = normalize([input.fileName, input.notes, input.documentText].filter(Boolean).join("\n"));
  const reviewItems: string[] = [];
  const domain = detectDomain(text);
  const deadline = extractDeadline(text);
  const value = extractBudget(text) ?? defaultBudget(domain);
  const documents = extractRequiredDocuments(text, input.availableDocuments, profile);
  const weights = extractScoringWeights(text);

  if (!deadline.detected) {
    reviewItems.push("Submission deadline was not found in the supplied text; using demo deadline for review.");
  }

  if (!extractBudget(text)) {
    reviewItems.push("Tender value was not found in the supplied text; budget is marked as estimated or to be confirmed.");
  }

  if (documents.some((document) => document.reviewReason)) {
    reviewItems.push("Some required documents were inferred from tender keywords and should be verified against the original PDF.");
  }

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

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

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

  if (isoDate?.[0]) {
    return { value: `${isoDate[0].replace(/[/.]/g, "-")} ${time} CET`, detected: true };
  }

  if (europeanDate?.[1] && europeanDate[2] && europeanDate[3]) {
    const [, day, month, year] = europeanDate;
    return {
      value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${time} CET`,
      detected: true
    };
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
  if (containsAny(text, ["e-procurement", "e procurement", "electronic procurement", "portal"])) {
    return "e-Procurement portal";
  }

  if (containsAny(text, ["sealed envelope", "physical submission"])) return "Physical submission";
  return sampleTender.channel;
}

function extractEligibilityCriteria(text: string, domain: string) {
  const criteria = new Set<string>();

  if (containsAny(text, ["registration", "registered company"])) {
    criteria.add("Company registration certificate is mandatory.");
  }

  if (containsAny(text, ["tax compliance", "tax clearance"])) {
    criteria.add("Tax compliance certificate must be submitted.");
  }

  if (containsAny(text, ["references", "similar projects", "previous experience"])) {
    criteria.add("Comparable project references are required for eligibility and scoring.");
  }

  if (containsAny(text, ["cv", "team", "key expert", "project manager"])) {
    criteria.add("Named delivery team CVs and role allocation must be included.");
  }

  if (containsAny(text, ["financial offer", "price offer", "price table"])) {
    criteria.add("Financial offer must follow the tender template exactly.");
  }

  if (domain === "construction") {
    criteria.add("Construction references and site safety documentation should be included.");
  } else {
    criteria.add("Implementation methodology must address delivery plan, risks, and support.");
  }

  return [...criteria];
}

function extractRequiredDocuments(
  text: string,
  availableDocuments: string[] = [],
  profile?: CompanyProfile
): TenderDocument[] {
  const available = normalize(availableDocuments.join(" "));
  const profileDocs = profile?.documents ?? [];

  const documents = documentRules
    .filter((rule) => containsAny(text, rule.keywords))
    .map((rule) => {
      const readyByAvailable = containsAny(available, [rule.name, ...rule.keywords]);

      const matchingProfileDoc = profileDocs.find((doc) =>
        containsAny(normalize([doc.name, ...doc.tags].join(" ")), [rule.name, ...rule.keywords])
      );

      const ready = readyByAvailable || Boolean(matchingProfileDoc);
      const evidence = matchingProfileDoc
        ? `Company profile: ${matchingProfileDoc.description}`
        : readyByAvailable
          ? "Matched against available company documents."
          : undefined;

      return {
        name: rule.name,
        owner: rule.owner,
        ready,
        ...(evidence ? { evidence } : {}),
        ...(!ready ? { reviewReason: "Required by tender keywords, not found in company profile or available documents." } : {})
      };
    });

  if (documents.length) return documents;

  return sampleTender.documents.map((document) => ({
    ...document,
    ready: false,
    reviewReason: "Default requirement; verify against original tender document."
  }));
}

function extractScoringWeights(text: string): TenderWeight[] {
  const explicitWeights = weightRules.map((rule) => {
    const keywordPattern = rule.keywords.join("|");
    const regex = new RegExp(`(?:${keywordPattern})[^0-9]{0,20}(\\d{1,3})\\s?(?:points|pts|%)`, "i");
    const match = text.match(regex);
    return {
      label: rule.label,
      value: match?.[1] ? Number(match[1]) : rule.value
    };
  });

  const total = explicitWeights.reduce((sum, weight) => sum + weight.value, 0);
  if (total === 100) return explicitWeights;

  return sampleTender.weights.map((weight) => ({ ...weight }));
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}
