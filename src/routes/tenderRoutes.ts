import type { FastifyInstance } from "fastify";
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
    };
  }>("/api/tenders/analyze", async (request) => analyzeTender(request.body ?? {}));

  app.post("/api/tenders/analyze-file", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: "Missing tender file" });
    }

    const buffer = await file.toBuffer();
    const notesField = file.fields.notes;
    const notes =
      notesField && !Array.isArray(notesField) && notesField.type === "field"
        ? String(notesField.value)
        : undefined;
    const input = {
      fileName: file.filename,
      fileSize: buffer.length,
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
      draft: buildDraft(type, tender, request.body?.companyProfile)
    };
  });
}
