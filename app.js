const sampleTender = {
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

const state = {
  tender: structuredClone(sampleTender),
  activeDraft: "summary",
  source: "Demo data"
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  chooseFile: document.querySelector("#chooseFile"),
  dropzone: document.querySelector("#dropzone"),
  fileStatus: document.querySelector("#fileStatus"),
  sourceBadge: document.querySelector("#sourceBadge"),
  snapshotList: document.querySelector("#snapshotList"),
  criteriaList: document.querySelector("#criteriaList"),
  weightsList: document.querySelector("#weightsList"),
  checklist: document.querySelector("#checklist"),
  checklistStatus: document.querySelector("#checklistStatus"),
  missingValue: document.querySelector("#missingValue"),
  scoreValue: document.querySelector("#scoreValue"),
  riskValue: document.querySelector("#riskValue"),
  sectionsValue: document.querySelector("#sectionsValue"),
  draftEditor: document.querySelector("#draftEditor"),
  draftTitle: document.querySelector("#draftTitle"),
  companyProfile: document.querySelector("#companyProfile"),
  exportDoc: document.querySelector("#exportDoc"),
  loadSample: document.querySelector("#loadSample"),
  refreshDrafts: document.querySelector("#refreshDrafts"),
  eligibilityStatus: document.querySelector("#eligibilityStatus")
};

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function deadlineRisk(deadline) {
  const date = new Date(deadline.replace(" CET", "+01:00"));
  if (Number.isNaN(date.getTime())) return "Medium";
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 7) return "High";
  if (days <= 21) return "Medium";
  return "Low";
}

function scoreTender() {
  const ready = state.tender.documents.filter((doc) => doc.ready).length;
  const total = state.tender.documents.length || 1;
  const complianceScore = Math.round((ready / total) * 45);
  const baseline = 38;
  const experienceBoost = state.tender.criteria.some((item) => item.toLowerCase().includes("reference")) ? 7 : 4;
  return Math.min(96, baseline + complianceScore + experienceBoost);
}

function renderSnapshot() {
  const rows = [
    ["Tender", state.tender.title],
    ["Buyer", state.tender.buyer],
    ["Region", state.tender.region],
    ["Deadline", state.tender.deadline],
    ["Budget", state.tender.value],
    ["Submission", state.tender.channel],
    ["Language", state.tender.language]
  ];

  els.snapshotList.innerHTML = rows
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");
  els.sourceBadge.textContent = state.source;
}

function renderCriteria() {
  els.criteriaList.innerHTML = state.tender.criteria
    .map((criterion) => `<li><span></span>${criterion}</li>`)
    .join("");

  const missing = state.tender.documents.filter((doc) => !doc.ready).length;
  els.eligibilityStatus.textContent = missing ? "Needs review" : "Ready";
}

function renderWeights() {
  els.weightsList.innerHTML = state.tender.weights
    .map(
      (weight) => `
        <div class="weight-row">
          <div class="weight-label"><span>${weight.label}</span><strong>${weight.value} pts</strong></div>
          <div class="bar"><span style="width: ${weight.value}%"></span></div>
        </div>
      `
    )
    .join("");
}

function renderChecklist() {
  els.checklist.innerHTML = state.tender.documents
    .map(
      (doc, index) => `
        <label class="check-item">
          <input type="checkbox" data-doc-index="${index}" ${doc.ready ? "checked" : ""}>
          <span>
            <strong>${doc.name}</strong>
            <span>${doc.owner}</span>
          </span>
          <em class="tag ${doc.ready ? "ready" : "missing"}">${doc.ready ? "Ready" : "Missing"}</em>
        </label>
      `
    )
    .join("");

  const ready = state.tender.documents.filter((doc) => doc.ready).length;
  const missing = state.tender.documents.length - ready;
  els.checklistStatus.textContent = `${ready} complete`;
  els.missingValue.textContent = String(missing);
  els.scoreValue.textContent = String(scoreTender());
  els.riskValue.textContent = deadlineRisk(state.tender.deadline);
}

function draftCopy(type) {
  const profile = els.companyProfile.value.trim();
  const tender = state.tender;
  const missing = tender.documents.filter((doc) => !doc.ready).map((doc) => doc.name);

  const drafts = {
    summary: `${tender.buyer}\n${tender.title}\n\nWe propose a compliant, delivery-focused response for ${tender.title}, built around clear governance, practical implementation milestones, and measurable service outcomes. Our company profile matches the tender's core needs: ${profile}\n\nThe bid should emphasize comparable references, bilingual delivery capacity, and a support model aligned with the requested ${tender.language} documentation requirements. Current compliance risk is concentrated in: ${missing.join(", ") || "no missing documents"}.\n\nRecommended positioning: low-risk regional partner with strong implementation discipline and rapid public-sector onboarding.`,
    technical: `Technical approach\n\n1. Discovery and compliance mapping\nWe will confirm all functional, legal, and submission requirements with ${tender.buyer}, then maintain a traceability matrix that maps every tender requirement to the relevant bid response, document, or delivery artifact.\n\n2. Implementation\nThe delivery plan covers discovery, configuration, integrations, migration, user acceptance testing, training, and go-live support. Workstreams will be managed through weekly checkpoints, issue logs, and acceptance criteria tied to the tender's scoring model.\n\n3. Support\nThe support model includes a 24-month maintenance period, incident triage, release management, knowledge transfer, and bilingual documentation for operational continuity.`,
    team: `Team qualifications\n\nProject manager: accountable for governance, buyer communication, reporting, and milestone control.\n\nSolution architect: accountable for platform design, integration decisions, security alignment, and technical quality gates.\n\nQA lead: accountable for test planning, acceptance evidence, defect management, and release readiness.\n\nThe team should attach CVs, role allocation, availability, and short proof points from at least three comparable projects. Missing CVs should be resolved before submission to avoid eligibility failure.`
  };

  return drafts[type];
}

function renderDraft() {
  const labels = {
    summary: "Executive summary",
    technical: "Technical approach",
    team: "Team qualifications"
  };
  els.draftTitle.textContent = labels[state.activeDraft];
  els.draftEditor.value = draftCopy(state.activeDraft);
  els.sectionsValue.textContent = "3";
}

function renderAll() {
  renderSnapshot();
  renderCriteria();
  renderWeights();
  renderChecklist();
  renderDraft();
}

function setView(view) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${view}`);
  });
}

function deriveTenderFromFile(file, text = "") {
  const lowered = text.toLowerCase();
  const hasConstruction = lowered.includes("construction") || lowered.includes("infrastructure");
  const hasIt = lowered.includes("software") || lowered.includes("platform") || lowered.includes("digital");

  state.tender = structuredClone(sampleTender);
  state.tender.title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  state.tender.value = hasConstruction ? "EUR 520,000" : hasIt ? "EUR 240,000" : "To be confirmed";
  state.tender.buyer = lowered.includes("municipality") ? "Municipality procurement office" : "Public contracting authority";
  state.tender.criteria = [
    "Legal registration and tax compliance certificates are mandatory.",
    hasConstruction
      ? "Comparable construction references and site safety plan must be included."
      : "Comparable project references and implementation methodology must be included.",
    "Named delivery team CVs and role allocation must be submitted.",
    "Financial offer must follow the tender template exactly.",
    "All required declarations must be signed before portal submission."
  ];
  state.tender.documents = [
    { name: "Business registration certificate", owner: "Finance", ready: true },
    { name: "Tax compliance certificate", owner: "Finance", ready: false },
    { name: "Comparable project references", owner: "Sales", ready: false },
    { name: "Delivery team CVs", owner: "Delivery", ready: true },
    { name: "Signed declarations", owner: "Legal", ready: false },
    { name: "Financial offer template", owner: "Finance", ready: false }
  ];
  state.source = `${file.name} - ${formatSize(file.size)}`;
  els.fileStatus.textContent = `${file.name} processed. Review extracted requirements and missing documents.`;
}

async function handleFile(file) {
  if (!file) return;
  let text = "";
  if (/text|markdown|json/.test(file.type) || /\.(txt|md|json)$/i.test(file.name)) {
    text = await file.text();
  }
  deriveTenderFromFile(file, text);
  renderAll();
  setView("analysis");
}

function exportBid() {
  const tender = state.tender;
  const ready = tender.documents.filter((doc) => doc.ready);
  const missing = tender.documents.filter((doc) => !doc.ready);
  const html = `
    <html>
      <head><meta charset="utf-8"><title>${tender.title} bid</title></head>
      <body>
        <h1>${tender.title}</h1>
        <p><strong>Buyer:</strong> ${tender.buyer}</p>
        <p><strong>Deadline:</strong> ${tender.deadline}</p>
        <p><strong>Estimated score:</strong> ${scoreTender()}/100</p>
        <h2>Ready documents</h2>
        <ul>${ready.map((doc) => `<li>${doc.name}</li>`).join("")}</ul>
        <h2>Missing documents</h2>
        <ul>${missing.map((doc) => `<li>${doc.name}</li>`).join("")}</ul>
        <h2>Executive summary</h2>
        <p>${draftCopy("summary").replace(/\n/g, "<br>")}</p>
        <h2>Technical approach</h2>
        <p>${draftCopy("technical").replace(/\n/g, "<br>")}</p>
        <h2>Team qualifications</h2>
        <p>${draftCopy("team").replace(/\n/g, "<br>")}</p>
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

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

document.querySelectorAll("[data-draft]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-draft]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.activeDraft = button.dataset.draft;
    renderDraft();
  });
});

els.chooseFile.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
els.loadSample.addEventListener("click", () => {
  state.tender = structuredClone(sampleTender);
  state.source = "Demo data";
  els.fileStatus.textContent = "Sample tender loaded. Review extracted requirements and draft sections.";
  renderAll();
});
els.refreshDrafts.addEventListener("click", renderDraft);
els.exportDoc.addEventListener("click", exportBid);

els.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropzone.classList.add("dragging");
});
els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragging"));
els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("dragging");
  handleFile(event.dataTransfer.files[0]);
});

els.checklist.addEventListener("change", (event) => {
  const input = event.target.closest("[data-doc-index]");
  if (!input) return;
  state.tender.documents[Number(input.dataset.docIndex)].ready = input.checked;
  renderChecklist();
  renderDraft();
});

renderAll();
