"use client";

import { useEffect, useMemo, useState } from "react";

type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
  evidence?: string;
  reviewReason?: string;
};

type TenderProfile = {
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

type AnalysisResult = {
  tender: TenderProfile;
  source: string;
  score: number;
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
  reviewItems: string[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000";

export default function Home() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [companyProfile, setCompanyProfile] = useState(
    "Prishtina-based software company with 18 engineers, public sector integrations, cloud delivery, and Albanian/English documentation capacity."
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const tender = analysis?.tender;

  const readyCount = useMemo(
    () => tender?.documents.filter((document) => document.ready).length ?? 0,
    [tender]
  );

  useEffect(() => {
    void loadSample();
  }, []);

  async function loadSample() {
    setLoading(true);
    const response = await fetch(`${apiBase}/api/tenders/sample`);
    const data = (await response.json()) as AnalysisResult;
    setAnalysis(data);
    setLoading(false);
  }

  async function analyzeExample() {
    setLoading(true);
    const response = await fetch(`${apiBase}/api/tenders/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "municipality-digital-platform.pdf",
        fileSize: 80400,
        notes: companyProfile,
        documentText:
          "Municipality digital platform tender. Deadline 2026-06-03 14:00. Required documents: company registration, tax compliance, references, project manager CV, methodology, financial offer. Scoring: technical methodology 35 points, relevant experience 25 points, team qualifications 20 points, price 15 points, support plan 5 points.",
        availableDocuments: ["Business registration certificate", "Project manager CV", "Implementation methodology"]
      })
    });
    const data = (await response.json()) as AnalysisResult;
    setAnalysis(data);
    setLoading(false);
  }

  async function createDraft(type: "summary" | "technical" | "team") {
    if (!tender) return;

    const response = await fetch(`${apiBase}/api/bids/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        tender,
        companyProfile
      })
    });
    const data = (await response.json()) as { draft: string };
    setDraft(data.draft);
  }

  return (
    <main className="page">
      <aside className="sidebar">
        <div className="brand">
          <span>TP</span>
          <div>
            <strong>TenderPilot</strong>
            <small>Next.js frontend</small>
          </div>
        </div>

        <label>
          Company profile
          <textarea value={companyProfile} onChange={(event) => setCompanyProfile(event.target.value)} rows={9} />
        </label>

        <button onClick={loadSample} type="button">Load sample</button>
        <button onClick={analyzeExample} type="button">Analyze demo tender</button>
      </aside>

      <section className="workspace">
        <header>
          <p>Kosovo and Balkan public procurement</p>
          <h1>Compliant tender analysis, powered by the Node API.</h1>
        </header>

        {loading && <div className="panel">Loading backend data...</div>}

        {analysis && tender && (
          <>
            <section className="metrics">
              <article><span>Score</span><strong>{analysis.score}</strong></article>
              <article><span>Risk</span><strong>{analysis.deadlineRisk}</strong></article>
              <article><span>Ready docs</span><strong>{readyCount}</strong></article>
              <article><span>Missing</span><strong>{analysis.missingDocuments.length}</strong></article>
            </section>

            <section className="grid">
              <article className="panel">
                <div className="panel-title">
                  <h2>{tender.title}</h2>
                  <span>{analysis.source}</span>
                </div>
                <dl>
                  <dt>Buyer</dt><dd>{tender.buyer}</dd>
                  <dt>Deadline</dt><dd>{tender.deadline}</dd>
                  <dt>Budget</dt><dd>{tender.value}</dd>
                  <dt>Submission</dt><dd>{tender.channel}</dd>
                </dl>
              </article>

              <article className="panel">
                <div className="panel-title">
                  <h2>Eligibility</h2>
                  <span>{analysis.missingDocuments.length ? "Needs review" : "Ready"}</span>
                </div>
                <ul>
                  {tender.criteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </article>
            </section>

            {analysis.reviewItems.length > 0 && (
              <section className="panel">
                <div className="panel-title">
                  <h2>Extraction review</h2>
                  <span>{analysis.reviewItems.length} items</span>
                </div>
                <ul>
                  {analysis.reviewItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="panel">
              <div className="panel-title">
                <h2>Compliance checklist</h2>
                <span>{readyCount} complete</span>
              </div>
              <div className="checklist">
                {tender.documents.map((document) => (
                  <div className="check-item" key={document.name}>
                    <strong>{document.name}</strong>
                    <span>{document.owner}</span>
                    <em className={document.ready ? "ready" : "missing"}>{document.ready ? "Ready" : "Missing"}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>Gap analysis</h2>
                <span>{analysis.missingDocuments.length} missing</span>
              </div>
              <div className="gap-list">
                {analysis.gapAnalysis.map((item) => (
                  <article className="gap-item" key={item.documentName}>
                    <div>
                      <strong>{item.documentName}</strong>
                      <span>{item.owner} / {item.severity} severity</span>
                    </div>
                    <em className={item.status}>{item.status}</em>
                    <p>{item.reason}</p>
                    <small>{item.recommendation}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>Bid drafts</h2>
                <span>From backend</span>
              </div>
              <div className="actions">
                <button onClick={() => createDraft("summary")} type="button">Executive summary</button>
                <button onClick={() => createDraft("technical")} type="button">Technical approach</button>
                <button onClick={() => createDraft("team")} type="button">Team qualifications</button>
              </div>
              <textarea value={draft} readOnly rows={12} placeholder="Choose a draft section." />
            </section>
          </>
        )}
      </section>
    </main>
  );
}
