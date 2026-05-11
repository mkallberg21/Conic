import {
  createAgreementSchema,
  createContactLeadSchema,
  submitDeliverableSchema
} from "@conic/contracts";
import type { FastifyInstance } from "fastify";
import z from "zod";
import { WorkflowService } from "../application/workflow-service.js";

const paramsWithAgreementId = z.object({
  agreementId: z.string().min(1)
});

const paramsWithDeliverableId = z.object({
  deliverableId: z.string().min(1)
});

export const registerRoutes = (app: FastifyInstance, service: WorkflowService): void => {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/v1/agreements", async () => {
    return { data: service.listAgreements() };
  });

  app.post("/api/v1/agreements", async (request, reply) => {
    const parsed = createAgreementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const agreement = service.createAgreement(parsed.data);
    return reply.status(201).send({ data: agreement });
  });

  app.get("/api/v1/deliverables", async (request) => {
    const querySchema = z.object({ agreementId: z.string().optional() });
    const query = querySchema.parse(request.query);
    return { data: service.listDeliverables(query.agreementId) };
  });

  app.post("/api/v1/agreements/:agreementId/deliverables", async (request, reply) => {
    const params = paramsWithAgreementId.parse(request.params);
    const body = submitDeliverableSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    try {
      const deliverable = service.submitDeliverable(params.agreementId, body.data);
      return reply.status(201).send({ data: deliverable });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  app.post("/api/v1/deliverables/:deliverableId/approve", async (request, reply) => {
    const params = paramsWithDeliverableId.parse(request.params);

    try {
      const payment = service.approveDeliverable(params.deliverableId);
      return reply.status(201).send({ data: payment });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  app.get("/api/v1/payments", async () => {
    return { data: service.listPayments() };
  });

  app.post("/api/v1/contact-leads", async (request, reply) => {
    const parsed = createContactLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const lead = service.createContactLead(parsed.data);
    return reply.status(201).send({ data: lead });
  });
};
