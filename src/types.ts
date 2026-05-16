export type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
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

export type AnalysisResult = {
  tender: TenderProfile;
  source: string;
  score: number;
  deadlineRisk: "Low" | "Medium" | "High";
  missingDocuments: TenderDocument[];
};

export type AnalyzeTenderInput = {
  fileName?: string;
  fileSize?: number;
  notes?: string;
};
