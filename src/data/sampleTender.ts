import type { TenderProfile } from "../types.js";

export const sampleTender: TenderProfile = {
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
