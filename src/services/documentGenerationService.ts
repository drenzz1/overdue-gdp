import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { generateText } from "./geminiService.js";
import type { CompanyProfile, GeneratedDocument, TenderProfile } from "../types.js";

const store = new Map<string, { doc: GeneratedDocument; docxBuffer: Buffer }>();

export async function generateDocumentContent(
  documentName: string,
  tender: TenderProfile,
  profile: CompanyProfile
): Promise<GeneratedDocument> {
  const docContext = profile.documents
    .map((d) => `  - ${d.name} [${d.category}]: ${d.description}`)
    .join("\n");

  const capContext = profile.capabilities.join(", ");

  const matchingDoc = profile.documents.find(
    (d) =>
      d.name.toLowerCase().includes(documentName.toLowerCase().slice(0, 20)) ||
      documentName.toLowerCase().includes(d.name.toLowerCase().slice(0, 20))
  );
  const evidenceNote = matchingDoc
    ? `\nSpecific company evidence for this document: ${matchingDoc.description}`
    : "";

  const typeInstructions = documentTypeInstructions(documentName);

  const prompt = `You are a professional bid document writer with expertise in public procurement in Kosovo and the Balkans.

Generate the complete, submission-ready content for the "${documentName}" document.
This document is for ${profile.name} bidding on "${tender.title}" (${tender.buyer}, ${tender.region}).

## Company Profile
Name: ${profile.name}
Description: ${profile.description}
Capabilities: ${capContext}

Company documents on file:
${docContext}
${evidenceNote}

## Tender Context
Contract value: ${tender.value}
Submission deadline: ${tender.deadline}
Required language: ${tender.language}
Eligibility criteria:
${tender.criteria.map((c) => `  - ${c}`).join("\n")}
Scoring weights:
${tender.weights.map((w) => `  - ${w.label}: ${w.value}%`).join("\n")}

## Document-Specific Instructions
${typeInstructions}

## General Instructions
- Write in formal, professional procurement language
- Do NOT use generic placeholder company names — use ${profile.name} throughout
- Where specific figures cannot be determined, use [PLACEHOLDER: description]
- Structure with clear headings using ## for sections
- Make content specific to both this company and this tender`;

  const content = await generateText(prompt, undefined, 2048);

  const id = `gendoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const docxBuffer = await assembleDocx(documentName, content);

  const doc: GeneratedDocument = {
    id,
    documentName,
    content,
    generatedAt: new Date().toISOString()
  };

  store.set(id, { doc, docxBuffer });
  return doc;
}

function documentTypeInstructions(documentName: string): string {
  const name = documentName.toLowerCase();

  if (name.includes("tax")) {
    return "Write a cover note for the tax compliance certificate. Confirm compliance status, issuing authority (ATK), validity period, and tax categories covered (VAT, corporate income tax, social contributions). 100–150 words.";
  }
  if (name.includes("registration")) {
    return "Write a formal declaration/cover letter presenting the business registration certificate. State company name, registration number, date of registration, and issuing authority (KBRA). Note that the original certificate is appended. 100–150 words.";
  }
  if (name.includes("reference")) {
    return "Write a full project reference summary. For each reference include: client name, project title, contract value, delivery period, scope (3–4 sentences), key outcomes, and client contact details. Format each reference as a separate ## section. 300–400 words total.";
  }
  if (name.includes("cv") || name.includes("curriculum")) {
    return "Write a professional CV. Sections: Personal Details, Role Summary, Key Qualifications and Certifications, Relevant Project Experience (4–6 projects with client name, role, duration, and scope), Technical Skills, Languages. 350–450 words. Use [PLACEHOLDER: full name] if name is unknown.";
  }
  if (name.includes("methodology") || name.includes("implementation") || name.includes("technical approach") || name.includes("timeline")) {
    return "Write a detailed implementation methodology with exactly four sections: ## 1. Discovery and Requirements Mapping, ## 2. Platform Development and Integration, ## 3. Migration, UAT, and Training, ## 4. Go-Live and Support. Each section 150–200 words. Reference the tender's specific scoring criteria. Total 600–800 words.";
  }
  if (name.includes("maintenance") || (name.includes("support") && name.includes("price"))) {
    return "Write a 24-month maintenance and SLA document. Include: ## Service Tiers (Tier 1 helpdesk, Tier 2 technical, Tier 3 escalation), ## Response Time Commitments per tier, ## Included Services (patches, releases, documentation, training updates), ## Pricing Structure (monthly retainer or unit rates with example figures). 300–400 words plus a structured pricing table.";
  }
  if (name.includes("declaration")) {
    return "Write a formal signed declaration covering: no conflict of interest, no blacklisting by any contracting authority, company is not under bankruptcy or liquidation proceedings, all submitted information is accurate and complete. Include a signature block. 150–200 words.";
  }
  if (name.includes("executive summary")) {
    return "Write a compelling executive summary (200–250 words) positioning the company as the ideal partner. Highlight alignment with tender scoring weights, the three strongest capabilities, comparable public sector references, and a clear commitment statement.";
  }
  if (name.includes("financial") || name.includes("price offer") || name.includes("price table")) {
    return "Write a formal financial offer with: cover letter confirming the total bid price, a breakdown by delivery phase (discovery, development, migration/training, support), unit rates for key line items, payment milestone schedule, and VAT treatment. 250–350 words plus a structured price table.";
  }

  return "Write a complete, professional document appropriate for public procurement submission. Use clear ## section headings. Length: 300–500 words appropriate to the document type.";
}

export function getDocxBuffer(id: string): { buffer: Buffer; documentName: string } | undefined {
  const entry = store.get(id);
  if (!entry) return undefined;
  return { buffer: entry.docxBuffer, documentName: entry.doc.documentName };
}

async function assembleDocx(title: string, content: string): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE
    })
  ];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    if (trimmed.startsWith("## ")) {
      children.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (trimmed.startsWith("# ")) {
      children.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2) })],
          bullet: { level: 0 }
        })
      );
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: trimmed })] }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }]
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
