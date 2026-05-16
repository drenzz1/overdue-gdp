import type { FastifyInstance } from "fastify";
import {
  getDatabaseStatus,
  listTenderDashboardItems,
  persistAnalysisResult,
  seedDemoTender
} from "../services/databaseService.js";
import { analyzeTender } from "../services/tenderService.js";

export async function registerDatabaseRoutes(app: FastifyInstance) {
  app.get("/api/database/status", async () => getDatabaseStatus());

  app.get("/api/database/tenders", async (request, reply) => {
    const status = await getDatabaseStatus();

    if (!status.connected) {
      return {
        status,
        tenders: []
      };
    }

    try {
      return {
        status,
        tenders: await listTenderDashboardItems()
      };
    } catch (error) {
      return reply.code(500).send({
        status: {
          ...status,
          connected: false,
          message: error instanceof Error ? error.message : "Unable to load persisted tenders."
        },
        tenders: []
      });
    }
  });

  app.post("/api/database/seed-demo", async (request, reply) => {
    const status = await getDatabaseStatus();

    if (!status.connected) {
      return reply.code(503).send({
        status,
        error: "Database is not connected."
      });
    }

    const tenderId = await seedDemoTender();
    return {
      tenderId,
      tenders: await listTenderDashboardItems()
    };
  });

  app.post<{
    Body: {
      fileName?: string;
      fileSize?: number;
      notes?: string;
      documentText?: string;
      availableDocuments?: string[];
    };
  }>("/api/database/analyze-and-save", async (request, reply) => {
    const status = await getDatabaseStatus();

    if (!status.connected) {
      return reply.code(503).send({
        status,
        error: "Database is not connected."
      });
    }

    const analysis = analyzeTender(request.body ?? {});
    const persistedTenderId = await persistAnalysisResult(analysis);

    return {
      ...analysis,
      persistedTenderId
    };
  });
}
