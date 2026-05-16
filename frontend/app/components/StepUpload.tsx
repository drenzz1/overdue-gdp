"use client";

import { useState } from "react";

type Props = {
  apiBase: string;
  profileDescription: string;
  onAnalyzed: (result: unknown) => void;
};

const STATUS_STEPS = [
  "Uploading document…",
  "Extracting text with AI…",
  "Analyzing requirements…",
  "Comparing against your profile…",
  "Building compliance report…"
];

export default function StepUpload({ apiBase, profileDescription, onAnalyzed }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState(profileDescription);
  const [loading, setLoading] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setError(null);
  }

  async function analyze() {
    if (!selectedFile) return;
    setError(null);
    setLoading(true);
    setStatusIndex(0);

    const interval = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_STEPS.length - 1));
    }, 2200);

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      if (notes.trim()) form.append("notes", notes.trim());

      const res = await fetch(`${apiBase}/api/tenders/analyze-file`, {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "Analysis failed");
        return;
      }

      const data = await res.json();
      onAnalyzed(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>Upload Tender Document</h2>
        <p className="muted">Upload a PDF or DOCX tender document. Gemini AI will read and analyze it against your company profile.</p>
      </div>

      <div className="upload-zone">
        <input
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          id="file-input"
          type="file"
          onChange={pickFile}
          style={{ display: "none" }}
        />
        <label htmlFor="file-input" className="upload-label">
          <div className="upload-icon">📄</div>
          {selectedFile ? (
            <>
              <strong>{selectedFile.name}</strong>
              <small className="muted">{(selectedFile.size / 1024).toFixed(1)} KB</small>
            </>
          ) : (
            <>
              <strong>Click to choose a file</strong>
              <small className="muted">PDF or DOCX, up to 20 MB</small>
            </>
          )}
        </label>
      </div>

      {error && <p className="upload-error">{error}</p>}

      <div className="form-group">
        <label htmlFor="bid-notes">Context notes (optional)</label>
        <textarea
          id="bid-notes"
          rows={3}
          placeholder="Any extra context about your company or bid strategy for this tender..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="analyze-loading">
          <div className="spinner" />
          <p>{STATUS_STEPS[statusIndex]}</p>
        </div>
      ) : (
        <button
          className="btn-primary btn-large"
          disabled={!selectedFile}
          onClick={analyze}
          type="button"
        >
          Analyze Tender with AI
        </button>
      )}
    </div>
  );
}
