import type { FastifyInstance } from "fastify";
import { persistAnalysisResult } from "../services/databaseService.js";
import { defaultDocumentAnalysisProvider } from "../services/documentAnalysisService.js";
import { analyzeTender, buildDraft, getSampleAnalysis } from "../services/tenderService.js";
import type { DraftType, TenderProfile } from "../types.js";

const draftTypes = new Set<DraftType>(["summary", "technical", "team"]);

export async function registerTenderRoutes(app: FastifyInstance) {
  app.get("/api/tenders/sample", async () => getSampleAnalysis());

  app.post<{
    Body: {
      fileName?: string;
      fileSize?: number;
      notes?: string;
      documentText?: string;
      availableDocuments?: string[];
      persist?: boolean;
    };
  }>("/api/tenders/analyze", async (request) => {
    const analysis = analyzeTender(request.body ?? {});

    if (request.body?.persist) {
      const persistedTenderId = await persistAnalysisResult(analysis);
      return {
        ...analysis,
        ...(persistedTenderId ? { persistedTenderId } : {})
      };
    }

    return analysis;
  });

  app.post("/api/tenders/analyze-file", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: "Missing tender file" });
    }

    const isPdf =
      file.mimetype === "application/pdf" ||
      file.filename.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      await file.toBuffer();
      return reply.code(400).send({ error: "Only PDF files are accepted" });
    }

    const buffer = await file.toBuffer();

    if (buffer.length > 20 * 1024 * 1024) {
      return reply.code(400).send({ error: "File size exceeds the 20 MB limit" });
    }

    const notesField = file.fields.notes;
    const notes =
      notesField && !Array.isArray(notesField) && notesField.type === "field"
        ? String(notesField.value)
        : undefined;

    const analysisResult = await defaultDocumentAnalysisProvider.analyzeDocument(
      buffer,
      file.filename,
      file.mimetype
    );

    const input = {
      fileName: file.filename,
      fileSize: buffer.length,
      documentText: analysisResult.extractedText,
      ...(notes ? { notes } : {})
    };

    return analyzeTender(input);
  });

  app.post<{
    Body: {
      type?: DraftType;
      tender?: TenderProfile;
      companyProfile?: string;
    };
  }>("/api/bids/draft", async (request, reply) => {
    const type = request.body?.type ?? "summary";

    if (!draftTypes.has(type)) {
      return reply.code(400).send({ error: "Invalid draft type" });
    }

    const tender = request.body?.tender ?? getSampleAnalysis().tender;
    return {
      type,
      draft: await buildDraft(type, tender, request.body?.companyProfile)
    };
  });
}
