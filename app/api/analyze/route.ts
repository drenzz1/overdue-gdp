import { NextResponse } from "next/server";

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

function titleFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded tender";
}

export async function GET() {
  return NextResponse.json({
    tender: sampleTender,
    source: "Demo data"
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const notes = String(formData.get("notes") || "").toLowerCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing tender file" }, { status: 400 });
  }

  const name = file.name || "Uploaded tender.pdf";
  const combined = `${name.toLowerCase()} ${notes}`;
  const construction = combined.includes("construction") || combined.includes("infrastructure");
  const software = combined.includes("software") || combined.includes("platform") || combined.includes("digital");

  const tender: TenderProfile = {
    ...sampleTender,
    title: titleFromFileName(name),
    buyer: combined.includes("municipality") ? "Municipality procurement office" : "Public contracting authority",
    value: construction ? "EUR 520,000" : software ? "EUR 240,000" : "To be confirmed",
    criteria: [
      "Legal registration and tax compliance certificates are mandatory.",
      construction
        ? "Comparable construction references and site safety plan must be included."
        : "Comparable project references and implementation methodology must be included.",
      "Named delivery team CVs and role allocation must be submitted.",
      "Financial offer must follow the tender template exactly.",
      "All required declarations must be signed before portal submission."
    ],
    documents: [
      { name: "Business registration certificate", owner: "Finance", ready: true },
      { name: "Tax compliance certificate", owner: "Finance", ready: false },
      { name: "Comparable project references", owner: "Sales", ready: false },
      { name: "Delivery team CVs", owner: "Delivery", ready: true },
      { name: "Signed declarations", owner: "Legal", ready: false },
      { name: "Financial offer template", owner: "Finance", ready: false }
    ]
  };

  return NextResponse.json({
    tender,
    source: `${name} - ${(file.size / 1024).toFixed(1)} KB`
  });
}
