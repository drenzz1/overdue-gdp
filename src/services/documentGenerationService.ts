import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { generateText } from "./geminiService.js";
import type { CompanyProfile, GeneratedDocument, TenderProfile } from "../types.js";

const store = new Map<string, { doc: GeneratedDocument; docxBuffer: Buffer }>();

export async function generateDocumentContent(
  documentName: string,
  tender: TenderProfile,
  profile: CompanyProfile
): Promise<GeneratedDocument> {
  const prompt = `You are a professional bid document writer with expertise in public procurement in Kosovo and the Balkans.

Generate the complete content for a "${documentName}" document for ${profile.name} to submit as part of their bid for "${tender.title}" from ${tender.buyer} in ${tender.region}.

Company profile:
Name: ${profile.name}
Description: ${profile.description}
Capabilities: ${profile.capabilities.join(", ")}
Documents on file: ${profile.documents.map((d) => `${d.name} — ${d.description}`).join("; ")}

Tender context:
Value: ${tender.value}
Deadline: ${tender.deadline}
Language: ${tender.language}
Criteria: ${tender.criteria.join("; ")}

Instructions:
- Write the complete, professional document content ready for submission
- Use clear section headings (prefixed with ## for subsections, # for main sections)
- Where specific data cannot be inferred, use [PLACEHOLDER: description] format
- Write in formal, professional procurement language
- Make it specific to this company and tender — not generic
- Length: appropriate for the document type (certificates 100–200 words, methodologies 500–800 words, CVs 300–400 words)`;

  const content = await generateText(prompt);
  

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
