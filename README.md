# TenderPilot

TenderPilot is a hackathon MVP prototype for turning public tender documents into a bid workspace. It is based on the supplied `TenderPilot_HackathonIdea_GDG.pdf` brief.

## Product Focus

- Upload a tender document and create an analysis workspace.
- Extract eligibility criteria, required documents, deadlines, and scoring weights.
- Show a compliance checklist with missing documents.
- Generate editable bid sections for executive summary, technical approach, and team qualifications.
- Simulate a bid score and export a Word-compatible bid document.

## Run Locally

```bash
npm run dev
```

Then open `http://localhost:4173`.

This prototype is dependency-free. PDF parsing is represented by a deterministic client-side extraction flow suitable for demo purposes; text files can influence the generated tender profile through keyword matching.
