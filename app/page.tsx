"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";

type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
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

type View = "intake" | "analysis" | "checklist" | "drafts";
type Draft = "summary" | "technical" | "team";

const sampleTender: TenderProfile = {
  title: "Municipal Digital Services Platform",
  buyer: "Municipality of Prishtina",
  region: "Kosovo",
  deadline: "2026-06-03 14:00 CET",
  value: "EUR 240,000",
  language: "Albanian and English",
  channel: "e-Procurement portal",
  criteria: [
    "Company registration and tax compliance certificates are mandatory.",
    "At least three comparable software delivery references from the last five years.",
    "Project manager, solution architect, and QA lead CVs must be included.",
    "Implementation plan must cover discovery, migration, training, and support.",
    "Bid must include maintenance pricing for a 24-month support period."
  ],
  weights: [
    { label: "Technical methodology", value: 35 },
    { label: "Relevant experience", value: 25 },
    { label: "Team qualifications", value: 20 },
    { label: "Price", value: 15 },
    { label: "Support plan", value: 5 }
  ],
  documents: [
    { name: "Business registration certificate", owner: "Finance", ready: true },
    { name: "Tax compliance certificate", owner: "Finance", ready: false },
    { name: "Three project references", owner: "Sales", ready: true },
    { name: "Project manager CV", owner: "Delivery", ready: true },
    { name: "Solution architect CV", owner: "Delivery", ready: false },
    { name: "QA lead CV", owner: "Delivery", ready: false },
    { name: "Implementation timeline", owner: "Delivery", ready: true },
    { name: "24-month maintenance price table", owner: "Finance", ready: false }
  ]
};

const draftLabels: Record<Draft, string> = {
  summary: "Executive summary",
  technical: "Technical approach",
  team: "Team qualifications"
};

function deadlineRisk(deadline: string) {
  const date = new Date(deadline.replace(" CET", "+01:00"));
  if (Number.isNaN(date.getTime())) return "Medium";
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 7) return "High";
  if (days <= 21) return "Medium";
  return "Low";
}

function scoreTender(tender: TenderProfile) {
  const ready = tender.documents.filter((doc) => doc.ready).length;
  const total = tender.documents.length || 1;
  const complianceScore = Math.round((ready / total) * 45);
  const experienceBoost = tender.criteria.some((item) => item.toLowerCase().includes("reference")) ? 7 : 4;
  return Math.min(96, 38 + complianceScore + experienceBoost);
}

function buildDraft(type: Draft, tender: TenderProfile, companyProfile: string) {
  const missing = tender.documents.filter((doc) => !doc.ready).map((doc) => doc.name);
  const missingText = missing.length ? missing.join(", ") : "no missing documents";

  const drafts: Record<Draft, string> = {
    summary: `${tender.buyer}
${tender.title}

We propose a compliant, delivery-focused response for ${tender.title}, built around clear governance, practical implementation milestones, and measurable service outcomes. Our company profile matches the tender's core needs: ${companyProfile}

The bid should emphasize comparable references, bilingual delivery capacity, and a support model aligned with the requested ${tender.language} documentation requirements. Current compliance risk is concentrated in: ${missingText}.

Recommended positioning: low-risk regional partner with strong implementation discipline and rapid public-sector onboarding.`,
    technical: `Technical approach

1. Discovery and compliance mapping
We will confirm all functional, legal, and submission requirements with ${tender.buyer}, then maintain a traceability matrix that maps every tender requirement to the relevant bid response, document, or delivery artifact.

2. Implementation
The delivery plan covers discovery, configuration, integrations, migration, user acceptance testing, training, and go-live support. Workstreams will be managed through weekly checkpoints, issue logs, and acceptance criteria tied to the tender's scoring model.

3. Support
The support model includes a 24-month maintenance period, incident triage, release management, knowledge transfer, and bilingual documentation for operational continuity.`,
    team: `Team qualifications

Project manager: accountable for governance, buyer communication, reporting, and milestone control.

Solution architect: accountable for platform design, integration decisions, security alignment, and technical quality gates.

QA lead: accountable for test planning, acceptance evidence, defect management, and release readiness.

The team should attach CVs, role allocation, availability, and short proof points from at least three comparable projects. Missing CVs should be resolved before submission to avoid eligibility failure.`
  };

  return drafts[type];
}

export default function Home() {
  const [view, setView] = useState<View>("intake");
  const [activeDraft, setActiveDraft] = useState<Draft>("summary");
  const [tender, setTender] = useState<TenderProfile>(sampleTender);
  const [source, setSource] = useState("Demo data");
  const [fileStatus, setFileStatus] = useState("Drop a PDF here or choose a file to create an analysis workspace.");
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(
    "Prishtina-based software company with 18 engineers, ISO-aligned delivery process, public sector integrations, cloud deployments, Albanian and English documentation capacity."
  );

  const readyCount = tender.documents.filter((doc) => doc.ready).length;
  const missingCount = tender.documents.length - readyCount;
  const score = scoreTender(tender);
  const draft = useMemo(
    () => buildDraft(activeDraft, tender, companyProfile),
    [activeDraft, companyProfile, tender]
  );

  async function analyzeFile(file: File | undefined) {
    if (!file) return;
    setAnalyzing(true);
    setFileStatus(`Analyzing ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("notes", companyProfile);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      setFileStatus("Analysis failed. Load sample data or try another file.");
      setAnalyzing(false);
      return;
    }

    const data = (await response.json()) as { tender: TenderProfile; source: string };
    setTender(data.tender);
    setSource(data.source);
    setFileStatus(`${file.name} processed. Review extracted requirements and missing documents.`);
    setAnalyzing(false);
    setView("analysis");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void analyzeFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void analyzeFile(event.dataTransfer.files[0]);
  }

  function updateDocument(index: number, ready: boolean) {
    setTender((current) => ({
      ...current,
      documents: current.documents.map((doc, docIndex) => (docIndex === index ? { ...doc, ready } : doc))
    }));
  }

  function exportBid() {
    const ready = tender.documents.filter((doc) => doc.ready);
    const missing = tender.documents.filter((doc) => !doc.ready);
    const html = `
      <html>
        <head><meta charset="utf-8"><title>${tender.title} bid</title></head>
        <body>
          <h1>${tender.title}</h1>
          <p><strong>Buyer:</strong> ${tender.buyer}</p>
          <p><strong>Deadline:</strong> ${tender.deadline}</p>
          <p><strong>Estimated score:</strong> ${score}/100</p>
          <h2>Ready documents</h2>
          <ul>${ready.map((doc) => `<li>${doc.name}</li>`).join("")}</ul>
          <h2>Missing documents</h2>
          <ul>${missing.map((doc) => `<li>${doc.name}</li>`).join("")}</ul>
          <h2>Executive summary</h2>
          <p>${buildDraft("summary", tender, companyProfile).replace(/\n/g, "<br>")}</p>
          <h2>Technical approach</h2>
          <p>${buildDraft("technical", tender, companyProfile).replace(/\n/g, "<br>")}</p>
          <h2>Team qualifications</h2>
          <p>${buildDraft("team", tender, companyProfile).replace(/\n/g, "<br>")}</p>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tender.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-bid.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">TP</div>
          <div>
            <strong>TenderPilot</strong>
            <span>Bid copilot</span>
          </div>
        </div>

        <nav className="nav" aria-label="Workspace">
          {[
            ["intake", "+", "Intake"],
            ["analysis", "#", "Analysis"],
            ["checklist", "OK", "Checklist"],
            ["drafts", "T", "Drafts"]
          ].map(([id, icon, label]) => (
            <button
              className={`nav-item ${view === id ? "active" : ""}`}
              key={id}
              onClick={() => setView(id as View)}
              type="button"
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="profile-panel">
          <label htmlFor="companyProfile">Company profile</label>
          <textarea
            id="companyProfile"
            rows={8}
            value={companyProfile}
            onChange={(event) => setCompanyProfile(event.target.value)}
          />
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Kosovo and Balkan public procurement</p>
            <h1>Turn a tender into a compliant bid workspace.</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="secondary-action"
              onClick={() => {
                setTender(sampleTender);
                setSource("Demo data");
                setFileStatus("Sample tender loaded. Review extracted requirements and draft sections.");
              }}
              type="button"
            >
              Load sample
            </button>
            <button className="primary-action" onClick={exportBid} type="button">Export bid</button>
          </div>
        </header>

        <section className="metrics" aria-label="Tender status">
          <article><span>Estimated score</span><strong>{score}</strong></article>
          <article><span>Deadline risk</span><strong>{deadlineRisk(tender.deadline)}</strong></article>
          <article><span>Missing docs</span><strong>{missingCount}</strong></article>
          <article><span>Bid sections</span><strong>3</strong></article>
        </section>

        {view === "intake" && (
          <section>
            <label
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input type="file" accept=".pdf,.txt,.md,.doc,.docx" onChange={handleFileChange} />
              <div className="document-visual" aria-hidden="true">
                <div className="doc-page">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="scan-line" />
              </div>
              <div>
                <h2>Upload tender document</h2>
                <p>{analyzing ? "Creating extraction workspace..." : fileStatus}</p>
                <span className="primary-action inline-action">Choose file</span>
              </div>
            </label>

            <div className="intake-grid">
              <Snapshot tender={tender} source={source} />
              <ExtractionQueue />
            </div>
          </section>
        )}

        {view === "analysis" && (
          <section className="analysis-layout">
            <article className="panel">
              <div className="panel-heading">
                <h3>Eligibility</h3>
                <span>{missingCount ? "Needs review" : "Ready"}</span>
              </div>
              <ul className="criteria-list">
                {tender.criteria.map((criterion) => (
                  <li key={criterion}><span />{criterion}</li>
                ))}
              </ul>
            </article>
            <article className="panel">
              <div className="panel-heading">
                <h3>Scoring weights</h3>
                <span>100 pts</span>
              </div>
              <div className="weights">
                {tender.weights.map((weight) => (
                  <div className="weight-row" key={weight.label}>
                    <div className="weight-label"><span>{weight.label}</span><strong>{weight.value} pts</strong></div>
                    <div className="bar"><span style={{ width: `${weight.value}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {view === "checklist" && (
          <section className="panel">
            <div className="panel-heading">
              <h3>Compliance checklist</h3>
              <span>{readyCount} complete</span>
            </div>
            <div className="checklist">
              {tender.documents.map((doc, index) => (
                <label className="check-item" key={doc.name}>
                  <input checked={doc.ready} onChange={(event) => updateDocument(index, event.target.checked)} type="checkbox" />
                  <span>
                    <strong>{doc.name}</strong>
                    <span>{doc.owner}</span>
                  </span>
                  <em className={`tag ${doc.ready ? "ready" : "missing"}`}>{doc.ready ? "Ready" : "Missing"}</em>
                </label>
              ))}
            </div>
          </section>
        )}

        {view === "drafts" && (
          <section>
            <div className="draft-toolbar">
              {(Object.keys(draftLabels) as Draft[]).map((draftKey) => (
                <button
                  className={`secondary-action ${activeDraft === draftKey ? "active" : ""}`}
                  key={draftKey}
                  onClick={() => setActiveDraft(draftKey)}
                  type="button"
                >
                  {draftLabels[draftKey]}
                </button>
              ))}
            </div>
            <article className="panel draft-panel">
              <div className="panel-heading">
                <h3>{draftLabels[activeDraft]}</h3>
                <span>Editable</span>
              </div>
              <textarea rows={18} value={draft} readOnly />
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function Snapshot({ tender, source }: { tender: TenderProfile; source: string }) {
  const rows = [
    ["Tender", tender.title],
    ["Buyer", tender.buyer],
    ["Region", tender.region],
    ["Deadline", tender.deadline],
    ["Budget", tender.value],
    ["Submission", tender.channel],
    ["Language", tender.language]
  ];

  return (
    <article className="panel">
      <div className="panel-heading">
        <h3>Tender snapshot</h3>
        <span>{source}</span>
      </div>
      <dl className="snapshot">
        {rows.map(([label, value]) => (
          <div className="snapshot-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ExtractionQueue() {
  return (
    <article className="panel">
      <div className="panel-heading">
        <h3>Extraction queue</h3>
        <span>Ready</span>
      </div>
      <ul className="queue-list">
        {[
          "Eligibility criteria",
          "Deadlines and submission channel",
          "Required documents",
          "Scoring weights",
          "Draftable response sections"
        ].map((item) => (
          <li key={item}><span />{item}</li>
        ))}
      </ul>
    </article>
  );
}
