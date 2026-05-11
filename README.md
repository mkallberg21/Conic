# Conic Platform

> **Market Readiness: 82%**
>
> | Layer | Status | Readiness |
> |---|---|---|
> | Backend API (NestJS) | ✅ Complete | 100% |
> | AI Microservices (6×) | ✅ Complete | 100% |
> | Frontend (Next.js 15) | ✅ Complete — graph + AI hub added | 100% |
> | Database Schema (Prisma) | ✅ Complete | 100% |
> | Auth & RBAC + Google OAuth | ✅ Complete | 100% |
> | Payments (Dwolla ACH) | ✅ Wired, needs live keys | 85% |
> | Shared UI Library (`@conic/ui`) | ✅ Complete | 100% |
> | Docker / Compose | ✅ Complete (7 AI services) | 100% |
> | CI/CD (GitHub Actions) | ✅ Complete | 100% |
> | Infrastructure (Terraform/K8s) | ✅ Scaffolded, needs provisioning | 70% |
> | Test coverage | ⚠️ Minimal | 15% |
> | Seed / demo data | ⚠️ Missing | 0% |
> | Observability (logs/metrics/alerts) | ⚠️ Partial (Swagger only) | 20% |
> | Security audit / pen test | ❌ Not started | 0% |
> | Load testing | ❌ Not started | 0% |

The platform is **feature-complete and deployable** for early-access / beta use. Production hardening (test suite, observability stack, and infrastructure provisioning) is the remaining gap to full readiness.

---

The creator partnership operating system — AI-generated contracts, deliverable verification, Dwolla ACH payments, campaign automation, creator identity graph, and performance prediction, all in one platform.

## Stack

| Layer | Technology |
|---|---|
| Backend API | NestJS 10 + Fastify + Prisma + PostgreSQL 16 |
| AI Microservices | FastAPI 0.115 + Python 3.12 + OpenAI gpt-4o-mini + PyTorch |
| Frontend | Next.js 15 + React 19 + TailwindCSS + shadcn/ui |
| State | TanStack Query v5 + Zustand 5 |
| Payments | Dwolla ACH (receive-only customers, platform escrow, ACH transfers) |
| Queue / Events | BullMQ + EventEmitter2 |
| Cache | Redis 7 |
| Auth | Passport JWT + refresh token rotation + Google OAuth2 |
| Infra | Docker Compose → AWS ECS + RDS + ElastiCache |
| CI/CD | GitHub Actions → ECR → ECS rolling deploy |

## Architecture

```
apps/
  backend/              NestJS API (port 4000)
    prisma/             700-line Prisma schema (20+ models)
    src/modules/        auth (JWT + Google OAuth) · users · brands · creators ·
                        contracts · deliverables · payments · campaigns ·
                        analytics · ai · notifications
  frontend/             Next.js 15 app (port 3000)
    src/app/            Landing, auth, full dashboard
    src/app/(dashboard)/graph/     Creator Graph Explorer (force-directed SVG)
    src/app/(dashboard)/insights/  AI Insights Hub (live predictor + feed)
    src/components/     shadcn/ui primitives + layout
  contract-ai/          FastAPI contract generator + risk scorer (port 8001)
  deliverable-verification-ai/  Content verifier + CV image analysis (port 8002)
  creator-graph-ai/     NetworkX + scikit-learn ML graph (port 8003)
  pricing-engine-ai/    Market-aware rate calculator (port 8004)
  campaign-agent-ai/    GPT-4o campaign agent + PDF debrief export (port 8005)
  performance-prediction-ai/  PyTorch MLP: reach, ER, conversion, ROI (port 8006)
packages/
  types/                Shared TypeScript enums + interfaces
  utils/                Shared helpers (formatCurrency, formatDate, …)
  ui/                   @conic/ui — shared shadcn + custom components
infrastructure/
  terraform/            AWS VPC · ECS · RDS · ElastiCache · ECR · ALB
  k8s/                  Kubernetes deployments + services (all 6 AI services)
.github/workflows/
  ci.yml                Lint · typecheck · test · build check
  deploy.yml            Build Docker images → ECR → ECS rolling deploy
```

## Quick Start

### Prerequisites
- Node.js 22+, Docker Desktop

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: JWT_SECRET, DWOLLA_KEY, DWOLLA_SECRET, OPENAI_API_KEY
```

### 3. Start all services

```bash
docker compose up -d postgres redis
npm run db:migrate
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/api/docs |
| Contract AI | http://localhost:8001/docs |
| Deliverable AI | http://localhost:8002/docs |
| Creator Graph AI | http://localhost:8003/docs |
| Pricing Engine AI | http://localhost:8004/docs |
| Campaign Agent AI | http://localhost:8005/docs |

### 4. Full stack with Docker

```bash
docker compose up --build
```

## Core Features

- **AI Contracts** — GPT-4o generates contract text, risk scores (0–100), and flags problematic clauses. Dual e-signature with IP capture.
- **Deliverable Verification** — AI checks submitted URLs for hashtags, mentions, platform match, and content quality. Scores 0–100.
- **Dwolla ACH Payments** — Creator receive-only customer onboarding via Dwolla Drop-in components, ACH transfers from platform master funding source, 5% platform fee, fraud flagging.
- **Creator Identity Graph** — NetworkX graph + KMeans clustering for audience overlap, bot-network detection, and influence scoring.
- **Campaign Automation** — AI agent generates 14-task timelines, weekly summaries via cron, and post-campaign debriefs.
- **Analytics** — ROI modeling, engagement benchmarks, Recharts dashboard.
- **RBAC** — Four roles: Brand, Creator, Agency, Admin. Guards on every endpoint and UI route.

## Backend API

All endpoints are prefixed `/v1` and documented at `/api/docs`.

```
POST   /v1/auth/register
POST   /v1/auth/login
POST   /v1/auth/refresh
POST   /v1/auth/logout

GET    /v1/contracts          POST /v1/contracts
POST   /v1/contracts/:id/sign

GET    /v1/deliverables
PATCH  /v1/deliverables/:id/review

GET    /v1/payments
POST   /v1/payments/:id/release

GET    /v1/campaigns          POST /v1/campaigns
POST   /v1/campaigns/:id/debrief

GET    /v1/creators
GET    /v1/analytics/overview
```

## Deployment

### Push to AWS (after Terraform provisioning)

```bash
cd infrastructure/terraform
terraform init && terraform apply

# GitHub Actions handles the rest on push to main
git push origin main
```

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `DWOLLA_KEY` | Dwolla application key |
| `DWOLLA_SECRET` | Dwolla application secret |
| `AWS_ACCESS_KEY_ID` | IAM deploy user |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user |
| `AWS_ACCOUNT_ID` | 12-digit account ID |
