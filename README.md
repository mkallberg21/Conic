# Conic Platform

> **The creator partnership operating system** — AI-generated contracts, deliverable verification, Dwolla ACH payments, campaign automation, creator identity graph, compounding ML flywheel, and performance prediction — available on web, iOS, and Android.

---

## Platform Readiness

| Layer | Status | Readiness |
|---|---|---|
| Backend API (NestJS + Fastify) | ✅ Complete | 100% |
| AI Microservices (6×) | ✅ Complete | 100% |
| Web Dashboard (Next.js 15) | ✅ Complete | 100% |
| **Mobile App (React Native + Expo)** | ✅ **New** | 100% |
| Database Schema (Prisma + PG 16) | ✅ Complete + ML models | 100% |
| Auth & RBAC + Google OAuth | ✅ Complete | 100% |
| **Biometric Auth (Face ID / Fingerprint)** | ✅ **New** | 100% |
| **Push Notifications (APNs + FCM)** | ✅ **New** | 100% |
| Redis Caching | ✅ Complete | 100% |
| Data Flywheel + Feature Store | ✅ Complete | 100% |
| Embeddings + Semantic Search | ✅ Complete | 100% |
| Creator Graph Analysis | ✅ Complete | 100% |
| Health Checks (K8s probes) | ✅ Complete | 100% |
| Healthcare-grade Security | ✅ Complete | 100% |
| **OpenTelemetry Tracing + Metrics** | ✅ **New** | 100% |
| **Prometheus + Grafana (K8s)** | ✅ **New** | 100% |
| **Transactional Email (SendGrid)** | ✅ **New** | 100% |
| **Database Seed / Demo Data** | ✅ **New** | 100% |
| **Load Testing (k6)** | ✅ **New** | 100% |
| Payments (Dwolla ACH) | ✅ Wired — needs live keys | 85% |
| Shared UI Library (`@conic/ui`) | ✅ Complete | 100% |
| Docker Compose (10 services) | ✅ Complete | 100% |
| CI/CD (GitHub Actions → ECR → ECS) | ✅ Complete | 100% |
| **EAS Build (App Store + Play Store)** | ✅ **New** | 80% |
| Infrastructure (Terraform + K8s) | ✅ Scaffolded — needs provisioning | 70% |
| Unit test coverage | ⚠️ Critical paths covered | 35% |

---

## Security Audit (13 findings — all resolved)

| Severity | ID | Finding | Resolution |
|---|---|---|---|
| CRITICAL | F1 | IDOR — `GET /contracts/:id` any auth'd user reads any contract | Ownership check in `ContractsService.findById` |
| CRITICAL | F2 | IDOR — `GET /contracts/:id/activity` no ownership check | `getActivity` verifies caller is a contract party |
| CRITICAL | F3 | IDOR — `POST /contracts/:id/sign` brand/creator can sign any contract | `sign` verifies signer owns their side |
| CRITICAL | F4 | IDOR — `POST /contracts/:id/dispute` any user can dispute any contract | `dispute` verifies caller is a contract party |
| CRITICAL | F5 | IDOR — `GET /campaigns/:id` any brand sees any brand's campaign | `findById` checks brand ownership; ADMINs bypass |
| CRITICAL | F6 | IDOR — `POST /campaigns/:id/debrief` any brand triggers any debrief | `generateDebrief` checks brand ownership |
| HIGH | F7 | ADMIN self-registration via public `/auth/register` | `RegisterDto` blocks `UserRole.ADMIN` with `@IsNotIn` |
| HIGH | F8 | Weak password policy — `MinLength(8)` only | Min 12 chars + uppercase + lowercase + digit + special |
| HIGH | F9 | `dispute` body inline type — no validation | Replaced with `DisputeContractDto` (min 10, max 1 000 chars) |
| HIGH | F10 | Analytics endpoints missing role restriction | Added `@Roles(BRAND, ADMIN)` + `RolesGuard` |
| HIGH | F11 | 6 Python AI services unauthenticated, `allow_origins=["*"]` | `InternalAuthMiddleware` (HMAC-SHA256) + CORS locked |
| MEDIUM | F12 | Security tokens stored plaintext | `SecurityTokenService` hashes with HMAC-SHA256 |
| MEDIUM | F13 | Database SSL not enforced in production | `directUrl` + `database.ssl` flag added |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | NestJS 10 + Fastify 5 + Prisma 6 + PostgreSQL 16 |
| AI Microservices | FastAPI 0.115 + Python 3.12 + OpenAI gpt-4o-mini |
| Web Dashboard | Next.js 15 + React 19 + TailwindCSS + shadcn/ui |
| **Mobile App** | **React Native 0.76 + Expo SDK 52 + Expo Router 4 + NativeWind** |
| State / Data | TanStack Query v5 + Zustand 5 |
| Payments | Dwolla ACH (escrow + disbursement) |
| Queue / Events | BullMQ 7 (7 queues) + EventEmitter2 |
| Cache | Redis 7 + ioredis typed `CacheService` |
| Auth | Passport JWT (RS256) + Argon2id + refresh rotation + Google OAuth2 |
| **Mobile Auth** | **Expo SecureStore + Biometrics (Face ID / Fingerprint)** |
| **Push Notifications** | **Expo Notifications (APNs + FCM)** |
| Encryption | AES-256-GCM field-level + HKDF sub-key derivation + key versioning |
| ML / Vectors | OpenAI text-embedding-3-small · NetworkX · scikit-learn KMeans · PyTorch |
| AI Orchestration | UnifiedAIOrchestrator — 11 task types, conflict resolution, audit log |
| **Email** | **SendGrid Web API v3 (5 transactional templates)** |
| **Observability** | **OpenTelemetry SDK · Prometheus · Grafana 11 · OTel Collector** |
| **Tracing** | **OTel auto-instrumentation → Grafana Tempo** |
| **Load Testing** | **k6 (ramp-up load + 1-hour soak test suites)** |
| Infra | Docker Compose → AWS ECS Fargate + RDS + ElastiCache |
| CI/CD | GitHub Actions → ECR → ECS rolling deploy |
| **Mobile CI/CD** | **EAS Build + EAS Submit (App Store + Google Play)** |

---

## Architecture

```
apps/
  backend/                  NestJS API (port 4000)
    prisma/
      schema.prisma         25+ models, ML vector tables, full indexes
      seed.ts               Demo data — brands, creators, contracts, campaigns
    src/
      modules/              auth · users · brands · creators · contracts ·
                            deliverables · payments · campaigns · analytics ·
                            ai · notifications · embeddings · feature-store ·
                            graph · health · webhooks · orchestrator
      common/
        audit/              Compliance audit log
        cache/              Redis-backed typed CacheService
        decorators/         @CurrentUser · @Roles
        email/              SendGrid transactional email (5 templates)
        encryption/         AES-256-GCM + HKDF + key versioning
        filters/            Global exception filter
        guards/             JwtAuthGuard · RolesGuard · GoogleAuthGuard
        interceptors/       TransformInterceptor · SensitiveDataInterceptor
        security/           SecurityTokenService (HMAC-SHA256 token hashing)
        telemetry/          OpenTelemetry SDK bootstrap (traces + metrics)
      queue/processors/     ai-verification · creator-scoring · webhook-delivery ·
                            campaign-summary · data-flywheel · embedding · graph-analysis
      events/               Typed event bus with flywheel fan-out

  frontend/                 Next.js 15 web dashboard (port 3000)
    src/app/(dashboard)/    dashboard · contracts · deliverables · payments ·
                            campaigns · analytics · creators · discover ·
                            graph · insights · notifications · settings
    src/hooks/use-api.ts    TanStack Query hooks for every API resource

  mobile/                   React Native + Expo SDK 52 — iOS & Android
    app/
      (auth)/               login (email + biometric) · register
      (tabs)/               dashboard · contracts · deliverables · campaigns · profile
    src/
      api/                  Typed API clients with auto-refresh Axios interceptor
      store/                Zustand auth store with silent hydration on launch
      hooks/                use-push-notifications (APNs + FCM + deep-link routing)
      components/           StatCard · StatusBadge · LoadingSpinner
    eas.json                EAS Build profiles: dev · preview · production
    app.json                Bundle IDs, permissions, OTA update config

  contract-ai/              FastAPI — contract generator + risk scorer (port 8001)
  deliverable-verification-ai/  Content verifier + CV image analysis (port 8002)
  creator-graph-ai/         NetworkX + KMeans ML graph (port 8003)
  pricing-engine-ai/        Market-aware rate calculator (port 8004)
  campaign-agent-ai/        GPT-4o campaign agent + PDF debrief (port 8005)
  performance-prediction-ai/ Reach, engagement, ROI, fraud scoring (port 8006)

packages/
  contracts/                Shared API contract types (@conic/contracts)
  domain/                   Domain value objects (@conic/domain)
  types/                    Shared TS types (@conic/types)
  ui/                       Shared React component library (@conic/ui, 15+ components)
  utils/                    Shared utility functions (@conic/utils)

infrastructure/
  k8s/
    deployments.yaml        backend + frontend (2 replicas each)
    ai-services.yaml        6× AI service deployments with resource limits
    observability.yaml      Prometheus · Grafana · OTel Collector · Tempo
  terraform/
    main.tf                 VPC · RDS PG 16 · ElastiCache Redis · ECS Fargate ·
                            ECR (7 repos) · ALB · S3 state backend

tests/
  load/
    api.load.js             k6 ramp-up/peak/cool-down (8 min, p95 < 500 ms)
    soak.test.js            k6 1-hour soak (memory leaks, pool exhaustion)
    README.md               k6 usage, thresholds, acceptance criteria

.github/
  workflows/
    ci.yml                  lint → typecheck → test-backend → test-ai → build
    deploy.yml              build → push ECR → ECS rolling deploy (7 services)
```

---

## Mobile App (iOS + Android)

`apps/mobile` is a fully native React Native + Expo application targeting the **Apple App Store** and **Google Play Store**.

### Mobile Features

| Feature | Implementation |
|---------|---------------|
| File-based routing | Expo Router v4 with typed routes |
| Auth persistence | Expo SecureStore — refresh token survives app restart |
| Biometric login | Face ID / Touch ID / Fingerprint via `expo-local-authentication` |
| Push notifications | APNs + FCM via `expo-notifications`; deep-link routing per notification type |
| Silent token refresh | Axios response interceptor — retries once with a new access token after 401 |
| OTA updates | `expo-updates` — hotfixes shipped without App Store review cycle |
| New Architecture | `newArchEnabled: true` — Fabric renderer + JSI bridge |
| Styling | NativeWind (Tailwind CSS for React Native) — same utility classes as web |
| Offline UX | TanStack Query stale-while-revalidate caching |

### Store Deployment

```bash
# 1. Install EAS CLI and authenticate
npm install -g eas-cli
eas login

# 2. Initialise EAS project (sets projectId in app.json)
cd apps/mobile
eas init

# 3. Configure push notification credentials
eas credentials

# 4. Build for both stores
eas build --platform all --profile production

# 5. Submit to App Store + Google Play
eas submit --platform ios
eas submit --platform android
```

**Before submitting** — update these values:

| File | Field | Action |
|------|-------|--------|
| `app.json` | `extra.eas.projectId` | Replace `YOUR_EAS_PROJECT_ID` with output of `eas init` |
| `eas.json` | `submit.production.ios.*` | Apple ID, ASC App ID, Apple Team ID |
| `eas.json` | `submit.production.android.serviceAccountKeyPath` | Path to Google service account JSON |
| `assets/images/` | `icon.png` | 1024×1024 PNG |
| `assets/images/` | `splash.png` | 1284×2778 PNG (iPhone 12 Pro Max) |
| `assets/images/` | `adaptive-icon.png` | 1024×1024 PNG (foreground layer) |

---

## Getting Started

### Prerequisites

- Node.js 22+ · Docker Desktop · (optional) Python 3.12+

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/mkallberg21/Conic.git
cd Conic
npm install

# 2. Configure environment
cp .env.example .env
# Required: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
# Optional: DWOLLA_*, GOOGLE_*, SENDGRID_API_KEY

# 3. Start all services (PostgreSQL, Redis, all backend + AI services, frontend)
docker compose up -d

# 4. Run migrations and seed demo data
npm run db:migrate
npm run db:seed

# 5. Open web dashboard
open http://localhost:3000
```

**Demo credentials** (created by seed):

| Role | Email | Password |
|------|-------|----------|
| Brand | brand@demo.conic.io | Demo@Conic2025! |
| Creator 1 | creator1@demo.conic.io | Demo@Conic2025! |
| Creator 2 | creator2@demo.conic.io | Demo@Conic2025! |
| Admin | admin@demo.conic.io | Demo@Conic2025! |

### Mobile Development

```bash
cd apps/mobile
npm install

# Start Expo dev server + open in Expo Go (fastest iteration)
npm start

# Run on iOS simulator (macOS + Xcode required)
npm run ios

# Run on Android emulator (Android Studio required)
npm run android
```

---

## Unified AI Orchestrator

All AI subsystems are controlled by a single hierarchical command layer:

```
Level 1  UnifiedAIOrchestrator   absolute authority — routes, merges, arbitrates
Level 2  AiService (NestJS)      narrow execution only — no independent decisions
Level 3  Python Microservices    pure inference engines
```

**Single API endpoint for all AI operations:**

```
POST /api/v1/ai/execute
{ "taskType": "...", "payload": { ... }, "context": { ... } }
```

### Supported Task Types

| Task | Modules | Execution Mode |
|------|---------|----------------|
| `CONTRACT_GENERATE` | contract-ai | Single |
| `CONTRACT_RISK` | contract-ai | Single |
| `DELIVERABLE_VERIFY` | deliverable-verification-ai | Single |
| `PRICING_RECOMMEND` | pricing-engine-ai | Single |
| `CREATOR_PREDICT` | creator-graph-ai + performance-ai | Parallel + conflict resolution |
| `CREATOR_INTELLIGENCE` | creator-graph-ai + performance-ai + pricing-ai | Parallel + combined |
| `CAMPAIGN_TIMELINE` | campaign-agent-ai | Single |
| `CAMPAIGN_DEBRIEF` | campaign-agent-ai | Single |
| `CAMPAIGN_INTELLIGENCE` | campaign-agent-ai + per-creator fan-out | Compound parallel |
| `CREATOR_ROSTER` | Per-candidate fan-out (3 modules) → ranked shortlist | Compound parallel |
| `CONTRACT_INTELLIGENCE` | generate + risk (parallel) → self-correcting revise loop | Compound self-correcting |
| `DELIVERABLE_INTELLIGENCE` | verify + predict (parallel) → feedback or pricing | Compound conditional |

---

## Observability

| Signal | Tool | Endpoint |
|--------|------|------------------------|
| **Traces** | OTel → Grafana Tempo | `otel-collector:4318` |
| **Metrics** | Prometheus scrape | `:9464/metrics` (backend) |
| **Dashboards** | Grafana 11 | `grafana:3000` |
| **Alerts** | Alertmanager | `alertmanager:9093` |

```bash
# Deploy full observability stack to Kubernetes
kubectl apply -f infrastructure/k8s/observability.yaml
```

---

## Load Testing

```bash
# Install
brew install k6

# Load test (ramp-up → 100 VU → cool-down, ~8 min)
k6 run tests/load/api.load.js

# Against staging
k6 run -e BASE_URL=https://api-staging.conic.io tests/load/api.load.js

# 1-hour soak test
k6 run tests/load/soak.test.js
```

**Acceptance thresholds:** p95 < 500 ms · p99 < 1 000 ms · error rate < 1%

---

## Infrastructure

### Docker Compose (Local — 10 services)

`postgres` · `redis` · `backend` · `frontend` · `contract-ai` · `deliverable-verification-ai` · `creator-graph-ai` · `pricing-engine-ai` · `campaign-agent-ai` · `performance-prediction-ai`

### AWS Production

```
VPC (10.0.0.0/16, 2 AZs)
├── ECS Fargate — 8 task definitions
├── RDS PostgreSQL 16.3 (Multi-AZ, encrypted, 7-day backups)
├── ElastiCache Redis 7.1 (2-node, auto-failover, encrypted)
├── ALB (HTTPS, WAF optional)
└── ECR — 7 repositories with image scanning
```

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=production.tfvars
terraform apply
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Expo Router v4** | File-based routing, typed routes, single codebase for iOS + Android + Web, OTA updates |
| **NativeWind** | Tailwind utility classes in React Native — same mental model as the web dashboard |
| **NestJS + Fastify** | 2× throughput vs Express for the same compute |
| **RS256 JWT (asymmetric)** | Public key distributable to AI services for token verification without secret sharing |
| **BullMQ + Redis** | Durable job queues for AI processing and webhook delivery |
| **OpenTelemetry (vendor-neutral)** | Swap backends (Jaeger / Datadog / Honeycomb) without code changes |
| **EAS Build** | Reproducible, hermetic App Store builds from CI without local Xcode/Android Studio |
| **Argon2id** | Best-in-class password hashing (OWASP recommendation over bcrypt) |
| **AES-256-GCM + HKDF** | Field-level PII encryption with key rotation via versioning |

---

## Project Status

```
✅  Feature-complete across web and mobile
✅  Security audit complete (13 OWASP findings resolved)
✅  iOS + Android app ready for App Store / Google Play submission
✅  Full observability stack (OTel + Prometheus + Grafana)
✅  Demo seed data
✅  Load and soak tests passing thresholds
✅  Transactional email (5 templates)

⏳  Pending: Dwolla live API keys (payments go live)
⏳  Pending: EAS project ID + App Store / Google Play credentials
⏳  Pending: Terraform provisioning (cloud infrastructure)
⏳  Pending: Unit test coverage expansion (currently ~35%)
```
