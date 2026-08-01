# Conic Architecture

> Last updated: May 2026 — reflects the production-ready platform

---

## Product Scope

Conic is the creator and athlete partnership operating system. It serves brands, creators, college athletes, agencies, and university compliance teams with a unified platform for:

- AI-generated contract lifecycle management
- Deliverable collection and computer-vision proof verification
- Dwolla ACH escrow and disbursement
- Campaign automation and AI-generated debriefs
- Creator identity graph with ML-powered network analysis
- NIL compliance engine (eligibility, FMV, disclosure, guardian approval)
- NIL marketplace for brand-to-athlete direct discovery
- Fraud detection across follower authenticity, engagement, and payments
- Enterprise API key ecosystem for third-party integrations
- Data importers (Opendorse, Teamworks, CSV) for competitive migration

---

## System Map

```
                         ┌─────────────────────────────────────────┐
                         │            Clients                       │
                         │  Next.js 15 (web)  │  React Native (iOS/Android)  │
                         └────────────┬────────────────┬────────────┘
                                      │                │
                               HTTPS / REST     HTTPS / REST
                                      │                │
                         ┌────────────▼────────────────▼────────────┐
                         │         NestJS Backend  (port 4000)       │
                         │   Fastify adapter · 26 feature modules    │
                         │   Passport JWT (RS256) + Google OAuth2    │
                         │   BullMQ 7 queues · EventEmitter2 bus     │
                         │   OpenTelemetry SDK (traces + metrics)    │
                         └──┬──────────────────────────────────┬────┘
                            │                                  │
              ┌─────────────▼──────────┐          ┌───────────▼──────────────┐
              │  PostgreSQL 16 (RDS)   │          │   Redis 7 (ElastiCache)  │
              │  61 Prisma models      │          │   Cache · BullMQ queues  │
              │  Encrypted at rest     │          │   Rate limiting          │
              └────────────────────────┘          └──────────────────────────┘
                            │
              Internal HMAC-SHA256 auth
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
┌──────▼──────┐   ┌─────────▼───────┐   ┌───────▼────────┐
│ contract-ai │   │deliverable-     │   │creator-graph-ai│
│  port 8001  │   │verification-ai  │   │   port 8003    │
│  GPT-4o-mini│   │   port 8002     │   │NetworkX+KMeans │
└─────────────┘   └─────────────────┘   └────────────────┘
┌──────▼──────┐   ┌─────────▼───────┐   ┌───────▼────────┐
│pricing-     │   │campaign-agent-  │   │performance-    │
│engine-ai    │   │ai  port 8005    │   │prediction-ai   │
│  port 8004  │   │GPT-4o + PDF     │   │  port 8006     │
└─────────────┘   └─────────────────┘   │  PyTorch MLP   │
┌──────▼──────┐   ┌─────────▼───────┐   └────────────────┘
│nil-         │   │fraud-detection- │
│compliance-ai│   │ai  port 8008    │
│  port 8007  │   │Heuristic+GPT    │
└─────────────┘   └─────────────────┘
```

---

## Service Boundaries

### NestJS Backend (`apps/backend`) — Port 4000

The primary API server. All client traffic routes here. Owns authentication, data persistence, business logic orchestration, and job queue management.

**26 feature modules:**

| Domain | Modules |
|--------|---------|
| Identity & Auth | `auth`, `users`, `brands`, `creators` |
| Contract Lifecycle | `contracts`, `contract-templates`, `deliverables` |
| Financial | `payments`, `tax-documents` |
| Campaigns | `campaigns` |
| NIL / Athlete | `nil-compliance`, `nil-marketplace`, `university`, `guardian`, `agent-profile` |
| Intelligence | `ai`, `orchestrator`, `feature-store`, `embeddings`, `graph` |
| Operations | `notifications`, `webhooks`, `analytics`, `api-keys`, `importers` |
| Infrastructure | `health` |

**Common infrastructure (shared across all modules):**

| Layer | Implementation |
|-------|----------------|
| Auth guards | `JwtAuthGuard` (RS256) · `RolesGuard` · `GoogleAuthGuard` |
| Encryption | AES-256-GCM field-level + HKDF sub-key derivation + key versioning |
| Caching | Redis-backed typed `CacheService` via `ioredis` |
| Audit log | Structured compliance audit entries on every mutation |
| Email | SendGrid Web API v3 — 5 transactional templates |
| Security tokens | `SecurityTokenService` — HMAC-SHA256 hashed storage |
| Telemetry | OpenTelemetry SDK — distributed traces + Prometheus metrics |
| Exception filter | Global filter — normalises all errors to RFC 7807 Problem JSON |
| Interceptors | `TransformInterceptor` (envelope) · `SensitiveDataInterceptor` (redaction) |

**BullMQ queues (7 processors):**

| Queue | Processor | Trigger |
|-------|-----------|---------|
| `ai-verification` | Deliverable AI analysis | Deliverable submitted |
| `creator-scoring` | Graph + ML re-score | Profile updated / deal closed |
| `webhook-delivery` | Signed HTTP dispatch | Any webhook event |
| `campaign-summary` | GPT-4o PDF debrief | Campaign completed |
| `data-flywheel` | Feature vector upsert | Model feedback received |
| `embedding` | OpenAI text-embedding-3-small | Content created/updated |
| `graph-analysis` | NetworkX community detection | Graph node added |

---

### Python AI Microservices

All 8 services share the same FastAPI security pattern: `InternalAuthMiddleware` validates an HMAC-SHA256 bearer token against `INTERNAL_API_SECRET` on every request. CORS is locked to `BACKEND_ORIGIN`. Docs are hidden in production.

| Service | Port | Capability |
|---------|------|-----------|
| `contract-ai` | 8001 | GPT-4o-mini contract generation, risk scoring (0–100), clause revision, template suggestions |
| `deliverable-verification-ai` | 8002 | NLP caption analysis, CV image verification, structured feedback generation |
| `creator-graph-ai` | 8003 | NetworkX graph inference, KMeans clustering, community/influence prediction |
| `pricing-engine-ai` | 8004 | Market-aware rate calculator — platform, niche, follower count, engagement rate |
| `campaign-agent-ai` | 8005 | GPT-4o timeline generation, AI debrief, insight extraction, PDF export |
| `performance-prediction-ai` | 8006 | PyTorch MLP — reach, engagement, ROI prediction with benchmark comparison |
| `nil-compliance-ai` | 8007 | NIL disclosure analysis, FMV range (low/mid/high), eligibility verdict, narrative reports |
| `fraud-detection-ai` | 8008 | Fake follower detection, engagement pod analysis, payment structuring signals |

**AI Orchestration Layer:**

```
Level 1  UnifiedAIOrchestrator (NestJS)   absolute authority — routes, merges, arbitrates
Level 2  AiService (NestJS)               narrow execution — calls microservices via HTTP
Level 3  Python Microservices             pure inference engines — no business logic
```

All AI work is initiated through a single endpoint: `POST /api/v1/ai/execute` with a typed `taskType` and `payload`. The orchestrator selects single, parallel, or compound compound-parallel execution strategies per task type.

---

### Web Dashboard (`apps/frontend`) — Port 3000

Next.js 15 + React 19 + TailwindCSS + shadcn/ui. 18 dashboard routes, role-aware sidebar (9 user roles), TanStack Query v5 data layer.

**Route map:**

```
(auth)/
  callback/     OAuth redirect handler
  login/        Email + biometric prep
  register/     New account creation

(dashboard)/
  analytics/          Platform usage metrics
  api-keys/           Ecosystem SDK key management
  athlete/            NIL athlete hub (deals, disclosures, earnings)
  campaigns/          Campaign creation and management
  contracts/          Contract lifecycle (create → sign → active → complete)
  creators/           Creator profiles and roster management
  deliverables/       Submission review and approval
  discover/           Creator/athlete marketplace search
  graph/              Creator network visualisation
  insights/           ML performance predictions
  marketplace/        NIL marketplace listings
  nil-compliance/     Compliance reporting and disclosure review
  notifications/      Activity feed
  payments/           Dwolla ACH disbursements
  school-reporting/   University/athletic department dashboard
  settings/           User preferences and account
```

---

### Mobile App (`apps/mobile`) — iOS + Android

React Native 0.76 + Expo SDK 52 + Expo Router 4 + NativeWind. Targets App Store and Google Play.

**Route map:**
```
(auth)/
  login.tsx      Email + Face ID / Fingerprint
  register.tsx   New account

(tabs)/
  index.tsx          Dashboard overview
  campaigns.tsx      Active campaign list
  contracts.tsx      Contract status
  deliverables.tsx   Submission workflow
  profile.tsx        Account and settings
```

**Key capabilities:** Expo SecureStore token persistence, biometric auth, APNs + FCM push notifications with deep-link routing, silent token refresh via Axios interceptor, EAS Build + EAS Submit for store deployment.

---

### Shared Packages

| Package | Alias | Contents |
|---------|-------|----------|
| `packages/contracts` | `@conic/contracts` | Zod request schemas — shared across the backend and services |
| `packages/domain` | `@conic/domain` | Value objects: Agreement, Deliverable, Payment, ContactLead, Party |
| `packages/types` | `@conic/types` | Cross-platform TypeScript interfaces |
| `packages/ui` | `@conic/ui` | 15+ shadcn/ui components + Conic-specific (StatCard, StatusBadge, DataTable) |
| `packages/utils` | `@conic/utils` | formatCurrency, formatDate, slugify, truncate, sleep |

---

## Data Model (61 Prisma models)

| Domain | Models |
|--------|--------|
| Identity | User, RefreshToken, Brand, Creator, Agency, AgentProfile, AgentRepresentation |
| Contracts | Contract, ContractTemplate, ContractVersion, ContractClause, ContractNilExtension |
| Deal Room | DealRoom, DealRoomMessage, DealRoomProposal |
| Delivery | Deliverable, Payment, PaymentMilestone |
| Campaigns | Campaign, CampaignTask, CampaignSummary |
| NIL / Athlete | Athlete, AthleteGraphNode, Guardian, GuardianRelationship, GuardianApproval, University, AthleticDepartment, ComplianceOfficer, NilCollective, NilDeal, NilDisclosure, Appearance, TaxDocument, FmvAssessment, ComplianceReport |
| NIL Collective | CollectiveDonor, CollectiveDonation, CollectiveMember, CollectiveDistribution |
| Matchmaking | MatchRequest, MatchResult |
| AI / ML | AIModel, AIRequest, CreatorPrediction, FeatureVector, EmbeddingRecord, CreatorGraphNode, CreatorGraphEdge, ModelRegistry, ModelDriftAlert, DataFlywheelEvent |
| Operations | Notification, AuditLog, WebhookEndpoint, WebhookDelivery, ContactLead, ApiKey, NilMarketplaceListing, ScimToken, ImportJob |

---

## Security Architecture

| Control | Implementation |
|---------|----------------|
| Auth | RS256 JWT access tokens (15 min) + Argon2id-hashed refresh tokens (7 day rotation) |
| RBAC | 9 roles: BRAND, CREATOR, ATHLETE, GUARDIAN, AGENT, COMPLIANCE_OFFICER, UNIVERSITY_ADMIN, ATHLETIC_DIRECTOR, ADMIN |
| OAuth | Google OAuth2 — token delivered via URL `#fragment` (never in server logs or Referer headers) |
| Passwords | Min 12 chars + uppercase + lowercase + digit + special char |
| Field encryption | AES-256-GCM + HKDF-derived per-field sub-keys + key version prefix for rotation |
| Token storage | All security tokens stored as HMAC-SHA256 hashes; raw value shown once |
| API keys | `sk_live_<40 hex>` format, SHA-256 hash stored, scoped permissions, usage tracking |
| AI auth | HMAC-SHA256 bearer token; all services `sys.exit(1)` if `INTERNAL_API_SECRET` missing |
| Rate limiting | Redis-backed: burst 20 req/s, standard 120 req/min, auth endpoints 10 req/min |
| IDOR prevention | All resource endpoints verify caller ownership before returning or mutating data |
| Pagination | All list endpoints paginated, max page size 100 |
| Transactions | Multi-step writes (contract creation, payment milestones) wrapped in `prisma.$transaction` |
| CORS | AI services locked to `BACKEND_ORIGIN` only |
| Secrets | docker-compose uses `${VAR:?error}` — refuses to start with unset secrets |

---

## Infrastructure

### Local Development (Docker Compose — 12 services)

```
postgres:16-alpine    port 5432   Primary database
redis:7-alpine        port 6379   Cache + job queues
backend               port 4000   NestJS API
frontend              port 3000   Next.js dashboard
contract-ai           port 8001
deliverable-verification-ai  port 8002
creator-graph-ai      port 8003
pricing-engine-ai     port 8004
campaign-agent-ai     port 8005
performance-prediction-ai    port 8006
nil-compliance-ai     port 8007
fraud-detection-ai    port 8008
```

### AWS Production (Terraform)

```
VPC (10.0.0.0/16, 2 AZs, NAT Gateway)
├── ECS Fargate + Fargate Spot
│   ├── conic-backend (2+ tasks)
│   ├── conic-frontend
│   └── conic-{8 AI services}
├── RDS PostgreSQL 16 (Multi-AZ, encrypted, deletion protection, 7-day backups)
├── ElastiCache Redis 7 (2-node cluster, auto-failover, in-transit + at-rest encryption)
├── ALB (HTTPS, path-based routing)
└── ECR (10 repositories, image scanning enabled)
```

### Kubernetes (K8s manifests)

| Manifest | Contents |
|----------|----------|
| `deployments.yaml` | backend (2 replicas) + frontend with readiness/liveness probes |
| `ai-services.yaml` | All 8 AI service Deployments + ClusterIP Services with resource limits |
| `observability.yaml` | Prometheus + Grafana 11 + OTel Collector + Grafana Tempo + Alertmanager |

### CI/CD

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `ci.yml` | Push to main/develop, PR to main | lint → typecheck → test-backend (PG+Redis) → test all 8 AI services |
| `deploy.yml` | Push to main, manual dispatch | build + push 10 Docker images to ECR → ECS rolling deploy |

---

## Observability

| Signal | Collector | Storage | UI |
|--------|-----------|---------|-----|
| Distributed traces | OTel auto-instrumentation → OTel Collector | Grafana Tempo | Grafana 11 |
| Metrics | Prometheus scrape `:9464/metrics` | Prometheus (15-day retention) | Grafana 11 |
| Alerts | Alertmanager rules | — | Alertmanager `:9093` |
| Structured logs | NestJS Logger → stdout | CloudWatch Logs (ECS) | CloudWatch Insights |

---

## Pending Before Go-Live

| Item | Status | Notes |
|------|--------|-------|
| Dwolla live API keys | ⏳ Pending | Payments fully wired — needs production credentials |
| EAS project ID + store credentials | ⏳ Pending | Replace `YOUR_EAS_PROJECT_ID` in `app.json`; add Apple/Google credentials to `eas.json` |
| App Store / Play Store assets | ⏳ Pending | `icon.png` (1024×1024), `splash.png`, `adaptive-icon.png` |
| Terraform provisioning | ⏳ Pending | Run `terraform apply` against AWS account |
| SCIM provisioning | ⏳ Pending | `ScimToken` model in schema; service + controller not yet built |
