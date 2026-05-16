import type { CompanyDocument, CompanyProfile } from "../types.js";

const defaultProfile: CompanyProfile = {
  name: "Demo Company",
  description:
    "Prishtina-based software company with 18 engineers, public sector integrations, cloud delivery, and Albanian/English documentation capacity.",
  capabilities: [
    "cloud delivery",
    "public sector integrations",
    "Albanian and English documentation",
    "software development",
    "agile implementation"
  ],
  documents: [
    {
      id: "doc-1",
      name: "Business registration certificate",
      category: "legal",
      description: "Company registration with Kosovo Business Registration Agency, valid and up to date.",
      tags: ["business registration", "company registration", "registration certificate", "legal"]
    },
    {
      id: "doc-2",
      name: "Project manager CV",
      category: "cv",
      description: "CV for senior project manager with 8+ years in public sector IT delivery.",
      tags: ["cv", "project manager", "key experts", "team qualifications"]
    },
    {
      id: "doc-3",
      name: "Implementation methodology",
      category: "capability",
      description: "Documented agile delivery methodology adapted for public sector procurement, covering discovery, migration, training, and support.",
      tags: ["methodology", "technical approach", "implementation plan", "delivery plan"]
    }
  ]
};

let currentProfile: CompanyProfile = cloneProfile(defaultProfile);

function cloneProfile(profile: CompanyProfile): CompanyProfile {
  return {
    ...profile,
    capabilities: [...profile.capabilities],
    documents: profile.documents.map((doc) => ({ ...doc, tags: [...doc.tags] }))
  };
}

export function getProfile(): CompanyProfile {
  return cloneProfile(currentProfile);
}

export function setProfile(profile: CompanyProfile): void {
  currentProfile = cloneProfile(profile);
}

export function addDocument(doc: CompanyDocument): void {
  currentProfile.documents.push({ ...doc, tags: [...doc.tags] });
}

export type ProfileContext = {
  matchedDocuments: CompanyDocument[];
  relevantCapabilities: string[];
};

export function retrieveContext(tenderText: string): ProfileContext {
  const text = tenderText.toLowerCase();

  const matchedDocuments = currentProfile.documents.filter(
    (doc) =>
      doc.tags.some((tag) => text.includes(tag.toLowerCase())) ||
      text.includes(doc.name.toLowerCase())
  );

  const relevantCapabilities = currentProfile.capabilities.filter((cap) =>
    text.includes(cap.toLowerCase())
  );

  return { matchedDocuments, relevantCapabilities };
}
