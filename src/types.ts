export type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
  evidence?: string;
  reviewReason?: string;
};

export type TenderWeight = {
  label: string;
  value: number;
};

export type TenderProfile = {
  title: string;
  buyer: string;
  region: string;
  deadline: string;
  value: string;
  language: string;
  channel: string;
  criteria: string[];
  weights: TenderWeight[];
  documents: TenderDocument[];
};

export type DraftType = "summary" | "technical" | "team";

export type ScoreFactor = {
  label: string;
  weight: number;
  earned: number;
  reason: string;
};

export type GapStatus = "ready" | "missing" | "review";

export type GapAnalysisItem = {
  documentName: string;
  owner: string;
  status: GapStatus;
  severity: "Low" | "Medium" | "High";
  reason: string;
  recommendation: string;
  evidence?: string;
};

export type GapAnalysisSummary = {
  totalDocuments: number;
  readyDocuments: number;
  missingDocuments: number;
  reviewDocuments: number;
  highSeverityBlockers: number;
  canQualify: boolean;
  qualificationMessage: string;
  ownerBreakdown: Array<{
    owner: string;
    ready: number;
    missing: number;
    review: number;
  }>;
  blockers: Array<{
    documentName: string;
    owner: string;
    severity: "Low" | "Medium" | "High";
    recommendation: string;
  }>;
};

export type AnalysisResult = {
  tender: TenderProfile;
  source: string;
  score: number;
  scoreBreakdown: ScoreFactor[];
  scoreExplanation: string;
  deadlineRisk: "Low" | "Medium" | "High";
  missingDocuments: TenderDocument[];
  gapAnalysis: GapAnalysisItem[];
  gapSummary: GapAnalysisSummary;
  reviewItems: string[];
  persistedTenderId?: string;
};

export type AnalyzeTenderInput = {
  fileName?: string;
  fileSize?: number;
  notes?: string;
  documentText?: string;
  availableDocuments?: string[];
};

export type CompanyDocumentCategory = "certification" | "reference" | "cv" | "capability" | "legal";

export type CompanyDocument = {
  id: string;
  name: string;
  category: CompanyDocumentCategory;
  description: string;
  tags: string[];
};

export type CompanyProfile = {
  name: string;
  description: string;
  capabilities: string[];
  documents: CompanyDocument[];
};

export type DatabaseStatus = {
  configured: boolean;
  connected: boolean;
  message: string;
};

export type TenderDashboardItem = {
  id: string;
  title: string;
  buyer: string;
  status: string;
  deadline: string | null;
  score: number | null;
  missingDocuments: number;
  createdAt: string;
};
