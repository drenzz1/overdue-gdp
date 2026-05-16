import type { FastifyInstance } from "fastify";
import { addDocument, getProfile, setProfile } from "../services/companyProfileService.js";
import type { CompanyDocument, CompanyProfile } from "../types.js";

export async function registerCompanyRoutes(app: FastifyInstance) {
  app.get("/api/company/profile", async () => getProfile());

  app.post<{ Body: CompanyProfile }>("/api/company/profile", async (request, reply) => {
    const body = request.body;
    if (!body?.name) {
      return reply.code(400).send({ error: "Profile must include a name" });
    }
    setProfile({
      name: body.name,
      description: body.description ?? "",
      capabilities: body.capabilities ?? [],
      documents: body.documents ?? []
    });
    return { ok: true };
  });

  app.post<{ Body: Omit<CompanyDocument, "id"> & { id?: string } }>(
    "/api/company/profile/documents",
    async (request, reply) => {
      const body = request.body;
      if (!body?.name || !body?.category) {
        return reply.code(400).send({ error: "Document must include name and category" });
      }
      const doc: CompanyDocument = {
        id: body.id ?? `doc-${Date.now()}`,
        name: body.name,
        category: body.category,
        description: body.description ?? "",
        tags: body.tags ?? []
      };
      addDocument(doc);
      return { ok: true, document: doc };
    }
  );
}
