"use client";

import { useState } from "react";

type CompanyDocumentCategory = "certification" | "reference" | "cv" | "capability" | "legal";

type CompanyDocument = {
  id: string;
  name: string;
  category: CompanyDocumentCategory;
  description: string;
  tags: string[];
};

type CompanyProfile = {
  name: string;
  description: string;
  capabilities: string[];
  documents: CompanyDocument[];
};

type Props = {
  profile: CompanyProfile | null;
  apiBase: string;
  onSaved: (profile: CompanyProfile) => void;
};

export default function StepProfile({ profile, apiBase, onSaved }: Props) {
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [capInput, setCapInput] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>(profile?.capabilities ?? []);
  const [saving, setSaving] = useState(false);

  const [newDocName, setNewDocName] = useState("");
  const [newDocCategory, setNewDocCategory] = useState<CompanyDocumentCategory>("capability");
  const [newDocDescription, setNewDocDescription] = useState("");
  const [newDocTags, setNewDocTags] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);

  function addCap() {
    const trimmed = capInput.trim();
    if (!trimmed || capabilities.includes(trimmed)) return;
    setCapabilities([...capabilities, trimmed]);
    setCapInput("");
  }

  function removeCap(cap: string) {
    setCapabilities(capabilities.filter((c) => c !== cap));
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: CompanyProfile = {
        name: name.trim(),
        description: description.trim(),
        capabilities,
        documents: profile?.documents ?? []
      };
      await fetch(`${apiBase}/api/company/profile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const res = await fetch(`${apiBase}/api/company/profile`);
      const updated = (await res.json()) as CompanyProfile;
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  async function addDoc() {
    if (!newDocName.trim()) return;
    setAddingDoc(true);
    try {
      await fetch(`${apiBase}/api/company/profile/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newDocName.trim(),
          category: newDocCategory,
          description: newDocDescription.trim(),
          tags: newDocTags.split(",").map((t) => t.trim()).filter(Boolean)
        })
      });
      setNewDocName("");
      setNewDocDescription("");
      setNewDocTags("");
      const res = await fetch(`${apiBase}/api/company/profile`);
      const updated = (await res.json()) as CompanyProfile;
      onSaved(updated);
    } finally {
      setAddingDoc(false);
    }
  }

  return (
    <div className="step-content">
      <div className="step-header">
        <h2>Company Profile</h2>
        <p className="muted">Tell us about your company so AI can match it against tender requirements.</p>
      </div>

      <div className="form-group">
        <label htmlFor="company-name">Company name</label>
        <input
          id="company-name"
          type="text"
          placeholder="e.g. Gjirafa Tech sh.p.k."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="company-desc">Company description</label>
        <textarea
          id="company-desc"
          rows={5}
          placeholder="Describe your company, expertise, and relevant public sector experience..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Capabilities</label>
        <div className="cap-input-row">
          <input
            type="text"
            placeholder="e.g. cloud delivery, Albanian documentation..."
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCap()}
          />
          <button type="button" className="btn-secondary" onClick={addCap}>Add</button>
        </div>
        {capabilities.length > 0 && (
          <div className="cap-tags">
            {capabilities.map((cap) => (
              <span className="cap-tag" key={cap}>
                {cap}
                <button type="button" className="cap-remove" onClick={() => removeCap(cap)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className="btn-primary"
        disabled={saving || !name.trim()}
        onClick={save}
        type="button"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>

      {profile && profile.documents.length > 0 && (
        <div className="doc-section">
          <h3>Documents on file</h3>
          <div className="profile-docs">
            {profile.documents.map((doc) => (
              <article className="profile-doc" key={doc.id}>
                <div>
                  <strong>{doc.name}</strong>
                  <span className="profile-doc-category">{doc.category}</span>
                </div>
                <small className="muted">{doc.description}</small>
                {doc.tags.length > 0 && (
                  <div className="doc-tags">
                    {doc.tags.map((t) => <span className="doc-tag" key={t}>{t}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="panel add-doc-panel">
        <h3>Add company document</h3>
        <p className="muted">Documents you add here will be used by AI to determine your readiness for each tender requirement.</p>
        <div className="form-row-2">
          <input
            placeholder="Document name"
            type="text"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
          />
          <select value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value as CompanyDocumentCategory)}>
            <option value="capability">Capability</option>
            <option value="certification">Certification</option>
            <option value="cv">CV</option>
            <option value="legal">Legal</option>
            <option value="reference">Reference</option>
          </select>
        </div>
        <input
          className="full-input"
          placeholder="Short description (what it proves)"
          type="text"
          value={newDocDescription}
          onChange={(e) => setNewDocDescription(e.target.value)}
        />
        <input
          className="full-input"
          placeholder="Tags (comma-separated, e.g. cv, project manager, methodology)"
          type="text"
          value={newDocTags}
          onChange={(e) => setNewDocTags(e.target.value)}
        />
        <button
          className="btn-primary"
          disabled={addingDoc || !newDocName.trim()}
          onClick={addDoc}
          type="button"
        >
          {addingDoc ? "Adding…" : "Add document"}
        </button>
      </div>
    </div>
  );
}
