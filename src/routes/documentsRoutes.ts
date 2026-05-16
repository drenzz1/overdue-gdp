import type { FastifyInstance } from "fastify";
import { generateDocumentContent, getDocxBuffer } from "../services/documentGenerationService.js";
import { getProfile } from "../services/companyProfileService.js";
import type { CompanyProfile, TenderProfile } from "../types.js";

export async function registerDocumentsRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      documentName: string;
      tender: TenderProfile;
      companyProfile?: CompanyProfile;
    };
  }>("/api/documents/generate", async (request, reply) => {
    const { documentName, tender, companyProfile } = request.body ?? {};

    if (!documentName?.trim()) {
      return reply.code(400).send({ error: "documentName is required" });
    }

    if (!tender?.title) {
      return reply.code(400).send({ error: "tender is required" });
    }

    const profile = companyProfile ?? getProfile();
    const doc = await generateDocumentContent(documentName, tender, profile);
    return doc;
  });

  app.get<{ Params: { id: string } }>("/api/documents/download/:id", async (request, reply) => {
    const entry = getDocxBuffer(request.params.id);

    if (!entry) {
      return reply.code(404).send({ error: "Document not found or expired" });
    }

    const safeName = entry.documentName.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "document";
    void reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    void reply.header("Content-Disposition", `attachment; filename="${safeName}.docx"`);
    return reply.send(entry.buffer);
  });
}
