# TenderPilot

TenderPilot is a Next.js hackathon MVP prototype for turning public tender documents into a bid workspace. It is based on the supplied `TenderPilot_HackathonIdea_GDG.pdf` brief.

## Product Focus

- Upload a tender document and create an analysis workspace.
- Extract eligibility criteria, required documents, deadlines, and scoring weights.
- Show a compliance checklist with missing documents.
- Generate editable bid sections for executive summary, technical approach, and team qualifications.
- Simulate a bid score and export a Word-compatible bid document.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

PDF parsing is represented by a deterministic `/api/analyze` route suitable for demo purposes. It derives a tender workspace from the uploaded file metadata and profile notes, ready to swap for a real document AI pipeline.
