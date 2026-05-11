import cors from "@fastify/cors";
import Fastify from "fastify";
import { WorkflowService } from "./application/workflow-service.js";
import { config } from "./config.js";
import { registerRoutes } from "./http/routes.js";
import { InMemoryStore } from "./infrastructure/store.js";

export const createServer = async () => {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.allowedOrigin
  });

  const store = new InMemoryStore();
  const workflowService = new WorkflowService(
    store,
    config.paymentProvider,
    config.paymentSettlementDays
  );

  registerRoutes(app, workflowService);

  return app;
};
