"use client";

import { useEffect, useState } from "react";
import StepAnalysis from "./components/StepAnalysis";
import StepDocuments from "./components/StepDocuments";
import StepProfile from "./components/StepProfile";
import StepUpload from "./components/StepUpload";

type CompanyDocument = {
  id: string;
  name: string;
  category: "certification" | "reference" | "cv" | "capability" | "legal";
  description: string;
  tags: string[];
};

type CompanyProfile = {
  name: string;
  description: string;
  capabilities: string[];
  documents: CompanyDocument[];
};

type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
  evidence?: string;
  reviewReason?: string;
};

type ScoreFactor = { label: string; weight: number; earned: number; reason: string };

type AnalysisResult = {
  tender: {
    title: string;
    buyer: string;
    region: string;
    deadline: string;
    value: string;
    language: string;
    channel: string;
    criteria: string[];
    weights: Array<{ label: string; value: number }>;
    documents: TenderDocument[];
  };
  source: string;
  score: number;
  scoreBreakdown: ScoreFactor[];
  scoreExplanation: string;
  deadlineRisk: "Low" | "Medium" | "High";
  missingDocuments: TenderDocument[];
  gapAnalysis: Array<{
    documentName: string;
    owner: string;
    status: "ready" | "missing" | "review";
    severity: "Low" | "Medium" | "High";
    reason: string;
    recommendation: string;
    evidence?: string;
  }>;
  gapSummary: {
    totalDocuments: number;
    readyDocuments: number;
    missingDocuments: number;
    reviewDocuments: number;
    highSeverityBlockers: number;
    canQualify: boolean;
    qualificationMessage: string;
    ownerBreakdown: Array<{ owner: string; ready: number; missing: number; review: number }>;
    blockers: Array<{ documentName: string; owner: string; severity: "Low" | "Medium" | "High"; recommendation: string }>;
  };
  reviewItems: string[];
  simplifiedSummary?: {
    whatYouNeedToWin: string[];
    winningFactors: string[];
    topRisks: string[];
  };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: "Company Profile",
  2: "Upload Tender",
  3: "Analysis",
  4: "Prepare Documents"
};

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/api/company/profile`);
        const data = (await res.json()) as CompanyProfile;
        setProfile(data);
      } catch {
        // backend not ready yet
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  function goTo(target: Step) {
    if (target < step) setStep(target);
    else if (target === 2 && step >= 1) setStep(2);
    else if (target === 3 && analysis) setStep(3);
    else if (target === 4 && analysis) setStep(4);
  }

  function handleAnalyzed(result: unknown) {
    setAnalysis(result as AnalysisResult);
    setStep(3);
  }

  return (
    <main className="page">
      <aside className="sidebar">
        <div className="brand">
          <span>TP</span>
          <div>
            <strong>TenderPilot</strong>
            <small>Tender analysis workspace</small>
          </div>
        </div>
        <nav className="wizard-nav">
          {([1, 2, 3, 4] as Step[]).map((s) => {
            const isDone = s < step;
            const isActive = s === step;
            const isAccessible = s < step || s === step || (s === 2) || (s === 3 && !!analysis) || (s === 4 && !!analysis);
            return (
              <button
                key={s}
                className={`wizard-step ${isActive ? "active" : isDone ? "done" : "locked"}`}
                disabled={!isAccessible}
                onClick={() => isAccessible && goTo(s)}
                type="button"
              >
                <span className="step-num">{isDone ? "✓" : s}</span>
                {STEP_LABELS[s]}
              </button>
            );
          })}
        </nav>
        {profile && (
          <div className="sidebar-profile">
            <strong>{profile.name}</strong>
            <small className="muted">{profile.documents.length} docs · {profile.capabilities.length} capabilities</small>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <p>Kosovo and Balkan public procurement</p>
          <h1>Compliant tender analysis, powered by AI.</h1>
        </header>

        {profileLoading ? (
          <div className="panel"><p className="muted">Loading profile…</p></div>
        ) : (
          <>
            {step === 1 && (
              <StepProfile
                profile={profile}
                apiBase={apiBase}
                onSaved={(updated) => {
                  setProfile(updated);
                  setStep(2);
                }}
              />
            )}

            {step === 2 && (
              <StepUpload
                apiBase={apiBase}
                profileDescription={profile?.description ?? ""}
                onAnalyzed={handleAnalyzed}
              />
            )}

            {step === 3 && analysis && (
              <StepAnalysis
                analysis={analysis}
                apiBase={apiBase}
                onPrepareDocuments={() => setStep(4)}
              />
            )}

            {step === 4 && analysis && (
              <StepDocuments
                tender={analysis.tender}
                apiBase={apiBase}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
