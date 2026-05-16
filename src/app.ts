import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { registerDatabaseRoutes } from "./routes/databaseRoutes.js";
import { registerHealthRoutes } from "./routes/healthRoutes.js";
import { registerTenderRoutes } from "./routes/tenderRoutes.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  void app.register(cors, {
    origin: true
  });

  void app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 1
    }
  });

  void app.register(registerHealthRoutes);
  void app.register(registerTenderRoutes);
  void app.register(registerDatabaseRoutes);

  return app;
}
