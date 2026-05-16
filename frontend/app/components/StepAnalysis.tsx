"use client";

import { useState } from "react";

type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
  evidence?: string;
  reviewReason?: string;
};

type ScoreFactor = {
  label: string;
  weight: number;
  earned: number;
  reason: string;
};

type SimplifiedSummary = {
  whatYouNeedToWin: string[];
  winningFactors: string[];
  topRisks: string[];
};

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
  simplifiedSummary?: SimplifiedSummary;
};

type Props = {
  analysis: AnalysisResult;
  apiBase: string;
  onPrepareDocuments: () => void;
};

export default function StepAnalysis({ analysis, apiBase, onPrepareDocuments }: Props) {
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const tender = analysis.tender;
  const readyCount = tender.documents.filter((d) => d.ready).length;

  async function createDraft(type: "summary" | "technical" | "team") {
    setDraftLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/bids/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, tender })
      });
      const data = (await res.json()) as { draft: string };
      setDraft(data.draft);
    } finally {
      setDraftLoading(false);
    }
  }

  const riskColor = { Low: "ready", Medium: "review", High: "missing" }[analysis.deadlineRisk];

  return (
    <div className="step-content">
      {analysis.simplifiedSummary && (
        <section className="panel summary-panel">
          <div className="panel-title">
            <h2>What you need to win this tender</h2>
            <span className={analysis.gapSummary.canQualify ? "status-ok" : "status-off"}>
              {analysis.gapSummary.canQualify ? "Can qualify" : "Needs action"}
            </span>
          </div>
          <ul className="summary-list">
            {analysis.simplifiedSummary.whatYouNeedToWin.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="summary-factors">
            <div>
              <h4>Winning factors</h4>
              <div className="factor-pills">
                {analysis.simplifiedSummary.winningFactors.map((f) => (
                  <span className="pill-ok" key={f}>{f}</span>
                ))}
              </div>
            </div>
            <div>
              <h4>Top risks</h4>
              <div className="factor-pills">
                {analysis.simplifiedSummary.topRisks.map((r) => (
                  <span className="pill-risk" key={r}>{r}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="metrics">
        <article><span>Score</span><strong>{analysis.score}/100</strong></article>
        <article><span>Deadline risk</span><strong className={riskColor}>{analysis.deadlineRisk}</strong></article>
        <article><span>Docs ready</span><strong>{readyCount}</strong></article>
        <article><span>Missing</span><strong>{analysis.missingDocuments.length}</strong></article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Score breakdown</h2>
          <span>{analysis.score}/100</span>
        </div>
        <p className="muted">{analysis.scoreExplanation}</p>
        <div className="score-breakdown">
          {analysis.scoreBreakdown.map((factor) => {
            const pct = factor.earned / factor.weight;
            const cls = pct >= 0.8 ? "ready" : pct < 0.5 ? "missing" : "review";
            return (
              <article className="score-factor" key={factor.label}>
                <div className="score-factor-header">
                  <strong>{factor.label}</strong>
                  <span className={cls}>{factor.earned}/{factor.weight}</span>
                </div>
                <div className="score-bar">
                  <div className="score-bar-fill" style={{ width: `${pct * 100}%` }} />
                </div>
                <small>{factor.reason}</small>
              </article>
            );
          })}
        </div>
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
            <h2>Eligibility criteria</h2>
            <span>{analysis.missingDocuments.length ? "Needs review" : "Ready"}</span>
          </div>
          <ul>
            {tender.criteria.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </article>
      </section>

      {analysis.reviewItems.length > 0 && (
        <section className="panel">
          <div className="panel-title">
            <h2>Extraction notes</h2>
            <span>{analysis.reviewItems.length} items</span>
          </div>
          <ul>
            {analysis.reviewItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>Compliance checklist</h2>
          <span>{readyCount} of {tender.documents.length} ready</span>
        </div>
        <div className="checklist">
          {tender.documents.map((doc) => (
            <div className="check-item" key={doc.name}>
              <div>
                <strong>{doc.name}</strong>
                {doc.evidence && <small className="muted"> — {doc.evidence}</small>}
              </div>
              <span>{doc.owner}</span>
              <em className={doc.ready ? "ready" : "missing"}>{doc.ready ? "Ready" : "Missing"}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Gap analysis</h2>
          <span className={analysis.gapSummary.canQualify ? "status-ok" : "status-off"}>
            {analysis.gapSummary.canQualify ? "Can qualify" : "Blocked"}
          </span>
        </div>
        <p className="muted">{analysis.gapSummary.qualificationMessage}</p>
        <div className="gap-summary">
          <article><span>Ready</span><strong>{analysis.gapSummary.readyDocuments}</strong></article>
          <article><span>Review</span><strong>{analysis.gapSummary.reviewDocuments}</strong></article>
          <article><span>Missing</span><strong>{analysis.gapSummary.missingDocuments}</strong></article>
          <article><span>High blockers</span><strong>{analysis.gapSummary.highSeverityBlockers}</strong></article>
        </div>
        {analysis.gapSummary.blockers.length > 0 && (
          <div className="blocker-list">
            <h3>Top blockers</h3>
            {analysis.gapSummary.blockers.slice(0, 4).map((item) => (
              <div className="blocker-item" key={`${item.documentName}-${item.owner}`}>
                <strong>{item.documentName}</strong>
                <span>{item.owner} / {item.severity}</span>
                <p>{item.recommendation}</p>
              </div>
            ))}
          </div>
        )}
        <div className="owner-grid">
          {analysis.gapSummary.ownerBreakdown.map((o) => (
            <article key={o.owner}>
              <strong>{o.owner}</strong>
              <span>{o.ready} ready</span>
              <span>{o.review} review</span>
              <span>{o.missing} missing</span>
            </article>
          ))}
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
          <span>AI-generated</span>
        </div>
        <div className="actions">
          <button disabled={draftLoading} onClick={() => createDraft("summary")} type="button">Executive summary</button>
          <button disabled={draftLoading} onClick={() => createDraft("technical")} type="button">Technical approach</button>
          <button disabled={draftLoading} onClick={() => createDraft("team")} type="button">Team qualifications</button>
        </div>
        {draftLoading && <p className="muted">Generating with AI…</p>}
        {draft && <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} />}
      </section>

      <div className="step-cta">
        <button className="btn-primary btn-large" onClick={onPrepareDocuments} type="button">
          Prepare Documents →
        </button>
        <p className="muted">Generate and download all required documents as .docx files</p>
      </div>
    </div>
  );
}
