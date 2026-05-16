"use client";

import { useState } from "react";

type TenderDocument = {
  name: string;
  owner: string;
  ready: boolean;
  evidence?: string;
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

type GeneratedDoc = {
  id: string;
  documentName: string;
  content: string;
};

type Props = {
  tender: TenderProfile;
  apiBase: string;
};

export default function StepDocuments({ tender, apiBase }: Props) {
  const [generatedDocs, setGeneratedDocs] = useState<Map<string, GeneratedDoc>>(new Map());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  // Also include bid draft sections as virtual documents
  const allDocuments = [
    ...tender.documents,
    { name: "Executive Summary (Bid Draft)", owner: "Bid Writing", ready: false },
    { name: "Technical Approach (Bid Draft)", owner: "Bid Writing", ready: false },
    { name: "Team Qualifications (Bid Draft)", owner: "Bid Writing", ready: false }
  ];

  async function generate(docName: string) {
    setGenerating((prev) => new Set(prev).add(docName));
    try {
      const res = await fetch(`${apiBase}/api/documents/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentName: docName, tender })
      });
      if (!res.ok) return;
      const data = (await res.json()) as GeneratedDoc;
      setGeneratedDocs((prev) => new Map(prev).set(docName, data));
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(docName);
        return next;
      });
    }
  }

  async function download(docName: string) {
    const doc = generatedDocs.get(docName);
    if (!doc) return;
    setDownloading((prev) => new Set(prev).add(docName));
    try {
      const res = await fetch(`${apiBase}/api/documents/download/${doc.id}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(docName);
        return next;
      });
    }
  }

  function updateContent(docName: string, content: string) {
    setGeneratedDocs((prev) => {
      const doc = prev.get(docName);
      if (!doc) return prev;
      return new Map(prev).set(docName, { ...doc, content });
    });
  }

  const generated = generatedDocs.size;
  const total = allDocuments.length;

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>Prepare Documents</h2>
        <p className="muted">
          Generate AI-drafted content for each required document. Review and edit before downloading as .docx.
        </p>
        {generated > 0 && (
          <span className="gen-progress">{generated} of {total} generated</span>
        )}
      </div>

      <div className="doc-grid">
        {allDocuments.map((doc) => {
          const isGenerating = generating.has(doc.name);
          const isDownloading = downloading.has(doc.name);
          const genDoc = generatedDocs.get(doc.name);

          return (
            <article className="doc-card" key={doc.name}>
              <div className="doc-card-header">
                <div>
                  <strong>{doc.name}</strong>
                  <span className="doc-owner">{doc.owner}</span>
                </div>
                <em className={doc.ready ? "ready" : "missing"}>
                  {doc.ready ? "Available" : "Needs draft"}
                </em>
              </div>

              {doc.evidence && (
                <small className="muted">Evidence: {doc.evidence}</small>
              )}

              {!genDoc && (
                <button
                  className="btn-generate"
                  disabled={isGenerating}
                  onClick={() => generate(doc.name)}
                  type="button"
                >
                  {isGenerating ? (
                    <><span className="spinner-sm" /> Generating…</>
                  ) : (
                    "Generate Full Draft"
                  )}
                </button>
              )}

              {genDoc && (
                <div className="doc-preview">
                  <div className="doc-preview-header">
                    <span className="preview-label">AI Draft — review and edit below</span>
                    <div className="doc-actions">
                      <button
                        className="btn-secondary btn-sm"
                        disabled={isGenerating}
                        onClick={() => generate(doc.name)}
                        type="button"
                      >
                        Regenerate
                      </button>
                      <button
                        className="btn-download"
                        disabled={isDownloading}
                        onClick={() => download(doc.name)}
                        type="button"
                      >
                        {isDownloading ? "…" : "↓ Download .docx"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="doc-textarea"
                    rows={10}
                    value={genDoc.content}
                    onChange={(e) => updateContent(doc.name, e.target.value)}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
