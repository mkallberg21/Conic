# Conic Platform Monorepo

This repository is a production-style starter architecture for Conic's operating model based on https://www.getconic.io/:
- brand and creator agreements
- deliverable proof submission
- approval workflows
- automated payment triggering
- contact lead intake

## Architecture

```text
apps/
  api/                  Fastify API implementing core workflows
  web/                  React operations console for teams
packages/
  contracts/            Shared Zod request schemas
  domain/               Shared domain entities and helpers
docs/
  architecture.md       System design and scaling plan
```

## Key Workflow Coverage

1. Create and execute digital agreements between brands and creators.
2. Submit and track proof of work deliverables.
3. Approve deliverables to automatically trigger payment scheduling.
4. Capture inbound brand/creator leads from contact forms.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start API and web app in parallel:

```bash
npm run dev
```

3. Open the web app at `http://localhost:5173`.

## API Endpoints

- `GET /health`
- `GET /api/v1/agreements`
- `POST /api/v1/agreements`
- `GET /api/v1/deliverables`
- `POST /api/v1/agreements/:agreementId/deliverables`
- `POST /api/v1/deliverables/:deliverableId/approve`
- `GET /api/v1/payments`
- `POST /api/v1/contact-leads`

## Notes

- Current persistence is in-memory for speed of iteration.
- `docker-compose.yml` includes Postgres and Redis to evolve into durable storage and job queues.
- `docs/architecture.md` details the target production architecture.
