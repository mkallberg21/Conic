# Conic Platform

> **The creator & athlete partnership operating system** — AI-generated contracts, real-time deal room negotiation, deliverable verification, Dwolla ACH payments, campaign automation, NIL collective management, AI-powered matchmaking, earnings intelligence, content calendar, creator identity graph, NIL compliance engine, compounding ML flywheel, fraud detection, marketplace discovery, and enterprise API — web, iOS, and Android.

---

## Platform Readiness

| Layer | Status | Readiness |
| --- | --- | --- |
| Backend API (NestJS + Fastify) | ✅ Complete | 100% |
| AI Microservices (8×) | ✅ Complete | 100% |
| Web Dashboard (Next.js 15) | ✅ Complete | 100% |
| **NIL Compliance Engine** | ✅ Complete | 100% |
| **NIL Marketplace (Athlete Discovery)** | ✅ Complete | 100% |
| **Fraud Detection AI** | ✅ Complete | 100% |
| **Contract Template Library** | ✅ Complete | 100% |
| **API Key Management (Ecosystem SDK)** | ✅ Complete | 100% |
| **Tax Document Workflow (W-9/1099)** | ✅ Complete | 100% |
| **Data Importers (Opendorse/Teamworks/CSV)** | ✅ Complete | 100% |
| **Deal Room (Real-Time Contract Negotiation)** | ✅ **New** | 100% |
| **NIL Collective Portal (Donors · Members · Distributions)** | ✅ **New** | 100% |
| **AI Matchmaking (Brand × Creator/Athlete)** | ✅ **New** | 100% |
| **Earnings Intelligence (YTD · Pipeline · Tax)** | ✅ **New** | 100% |
| **Content Calendar (Unified Event View)** | ✅ **New** | 100% |
| **Mobile App (React Native + Expo)** | ✅ Complete | 100% |
| Database Schema (Prisma + PG 16) | ✅ Complete — 68 models | 100% |
| Auth & RBAC + Google OAuth | ✅ Complete | 100% |
| Biometric Auth (Face ID / Fingerprint) | ✅ Complete | 100% |
| Push Notifications (APNs + FCM) | ✅ Complete | 100% |
| Redis Caching | ✅ Complete | 100% |
| Data Flywheel + Feature Store | ✅ Complete | 100% |
| Embeddings + Semantic Search | ✅ Complete | 100% |
| Creator Graph Analysis | ✅ Complete | 100% |
| Health Checks (K8s probes) | ✅ Complete | 100% |
| Healthcare-grade Security | ✅ Complete | 100% |
| OpenTelemetry Tracing + Metrics | ✅ Complete | 100% |
| Prometheus + Grafana (K8s) | ✅ Complete | 100% |
| Transactional Email (SendGrid) | ✅ Complete | 100% |
| Database Seed / Demo Data | ✅ Complete | 100% |
| Load Testing (k6) | ✅ Complete | 100% |
| Payments (Dwolla ACH) | ✅ Wired — needs live keys | 85% |
| Shared UI Library (`@conic/ui`) | ✅ Complete | 100% |
| Docker Compose (12 services) | ✅ Complete | 100% |
| CI/CD (GitHub Actions → ECR → ECS) | ✅ Complete | 100% |
| EAS Build (App Store + Play Store) | ✅ Complete | 80% |
| Infrastructure (Terraform + K8s) | ✅ Scaffolded — needs provisioning | 70% |
| Unit test coverage | ✅ Critical paths (auth · contracts · payments) | 55% |

---

## Five Category-Leading Features

### 1. Deal Room — Real-Time Contract Negotiation
A dedicated negotiation hub attached to every contract. Parties can message in real-time, submit clause-level proposals, and accept/reject/counter-propose changes. The AI risk-scores every proposal against the contract content so both sides see the impact of changes before agreeing. Once both parties click "Agree to Terms" the room closes and the contract advances to signature.

**Endpoints**: `POST /deal-room/open`, `GET /deal-room/:contractId`, `POST /deal-room/:contractId/messages`, `POST /deal-room/:contractId/proposals`, `PATCH .../proposals/:id/accept|reject|counter`, `PATCH .../agree|close`

### 2. NIL Collective Portal — Full Fund Management
Full lifecycle management for NIL collectives: create collectives, add/remove athlete members with share percentages, record donations (donor deduplication via upsert), and create proportional distributions that validate fund availability and distribute by share percent — all inside atomic Prisma transactions.

**Endpoints**: `GET/POST /collectives`, `GET /collectives/:id/summary`, `POST/DELETE /collectives/:id/members`, `POST/GET /collectives/:id/donations`, `POST/GET /collectives/:id/distributions`

### 3. AI Matchmaking — Brand × Creator/Athlete Pairing
Brands submit a plain-text campaign brief with filters (niche, platform, followers, budget, entity type). The matchmaking engine queries verified creators and athletes, scores each candidate on a weighted combination of performance score (40%), audience authenticity (30%), and fraud score (30%), estimates CPM-based rates, and returns a ranked list with reasoning and AI flags. Processing is async — the request returns immediately with a `PENDING` status and results appear within seconds.

**Endpoints**: `POST /matchmaking/requests`, `GET /matchmaking/requests`, `GET /matchmaking/requests/:id`

### 4. Earnings Intelligence — Income, Pipeline & Tax
Role-aware earnings dashboard. Creators see YTD net earnings, pending payments, active contract pipeline value, and a 15.3% self-employment tax estimate. Athletes see collective distributions and NIL deal pipeline. Brands see YTD spend. All roles get a 12-month breakdown and recent transaction history.

**Endpoints**: `GET /earnings/summary`, `GET /earnings/breakdown?year=`, `GET /earnings/pipeline`

### 5. Content Calendar — Unified Event View
A single calendar aggregating every time-sensitive event: deliverable due dates, payment milestones, appearance bookings, campaign timelines, and campaign tasks — all filtered by the caller's role. The frontend renders a full monthly grid with color-coded event types (deliverable=blue, payment=green, appearance=purple, campaign=orange, task=gray). Click any day to see the full event list.

**Endpoint**: `GET /calendar?start=ISO&end=ISO`

---

## Security Audit (25 findings — all resolved)

### Original findings

| Severity | ID | Finding | Resolution |
| --- | --- | --- | --- |
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

### Production hardening pass (May 2026)

| Severity | ID | Finding | Resolution |
| --- | --- | --- | --- |
| CRITICAL | H1 | OAuth tokens exposed in URL query params (`?accessToken=...`) — logged by servers, proxies, and browser history | Redirects to `#fragment` — never reaches server logs or `Referer` headers |
| CRITICAL | H2 | All 6 AI services start successfully even when `INTERNAL_API_SECRET` is unset | `_load_secret()` calls `sys.exit(1)` at import time if secret is missing in production |
| HIGH | H3 | `users.findAll` returned unbounded result set — DoS vector | Paginated with `$transaction([findMany, count])`; max page size 100; returns `{ items, total, page, pageSize, totalPages }` |
| HIGH | H4 | `payments.findAll` returned unbounded result set | Paginated with `$transaction([findMany, count])`; max page size 100 |
| HIGH | H5 | `contracts.create` wrote brand + creator lookups and contract row in separate statements — partial-write possible | Wrapped in `prisma.$transaction(async tx => ...)` |
| HIGH | H6 | Dwolla client typed as `any` throughout `PaymentsService` | Replaced with `DwollaAppToken` interface; all calls type-safe |
| HIGH | H7 | `docker-compose.yml` contained hardcoded weak secrets (`postgres`, `secret`) | All values replaced with `${VAR:?error}` required-variable syntax; Docker Compose refuses to start without them |
| HIGH | H8 | `INTERNAL_API_SECRET` not propagated to AI services in `docker-compose.yml` | Added to all 6 AI service environment blocks |
| MEDIUM | H9 | `contract-ai` generate endpoint fell back to a hardcoded template contract when OpenAI failed | Removed fallback; raises `HTTP 502` with structured log on AI failure |
| MEDIUM | H10 | `contract-ai` risk endpoint silently swallowed JSON parse errors; flag values not validated | Raises `HTTP 502` on parse failure; flags validated against `_KNOWN_FLAGS` whitelist |
| MEDIUM | H11 | Redis cache module used bare `console.error` — log lost in production | Replaced with NestJS `Logger`; added `connect`, `ready`, `reconnecting`, `close` event handlers |
| LOW | H12 | `.env.example` incomplete — no secrets documented | Completely rewritten; all required variables documented with `openssl rand -base64 48` generation instructions |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
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
| **Fraud Detection** | **Heuristic + GPT-4o-mini: fake followers, engagement pods, payment structuring, identity** |
| **Email** | **SendGrid Web API v3 (5 transactional templates)** |
| **Observability** | **OpenTelemetry SDK · Prometheus · Grafana 11 · OTel Collector** |
| **Tracing** | **OTel auto-instrumentation → Grafana Tempo** |
| **Load Testing** | **k6 (ramp-up load + 1-hour soak test suites)** |
| Infra | Docker Compose → AWS ECS Fargate + RDS + ElastiCache |
| CI/CD | GitHub Actions → ECR → ECS rolling deploy |
| **Mobile CI/CD** | **EAS Build + EAS Submit (App Store + Google Play)** |

---

## Architecture

```text
apps/
  backend/                  NestJS API (port 4000)
    prisma/
      schema.prisma         68 models: creator, brand, athlete, NIL, contracts,
                            marketplace, deal rooms, collectives, matchmaking,
                            API keys, imports, tax docs, ML vectors
      seed.ts               Demo data — brands, creators, contracts, campaigns
    src/
      modules/              auth · users · brands · creators · contracts ·
                            deliverables · payments · campaigns · analytics ·
                            ai · notifications · embeddings · feature-store ·
                            graph · health · webhooks · orchestrator ·
                            nil-compliance · university · guardian · agent-profile ·
                            tax-documents · contract-templates · api-keys ·
                            nil-marketplace · importers · deal-room ·
                            collective-portal · matchmaking · earnings · calendar
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
                            graph · insights · notifications · settings ·
                            nil-compliance · athlete · school-reporting ·
                            marketplace · api-keys · contract-templates ·
                            deal-room · earnings · collectives · match · calendar
    src/components/layout/  Sidebar — role-aware nav for 9 user roles (31 routes)
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
  performance-prediction-ai/ PyTorch MLP — reach, engagement, ROI prediction (port 8006)
  nil-compliance-ai/        NIL disclosure analysis, FMV assessment, eligibility (port 8007)
  fraud-detection-ai/       Fake followers, engagement pods, identity & payment fraud (port 8008)

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
    ci.yml                  lint → typecheck → test-backend → test-all-8-ai-services → build
    deploy.yml              build → push ECR → ECS rolling deploy (10 services)
```

---

## Mobile App (iOS + Android)

`apps/mobile` is a fully native React Native + Expo application targeting the **Apple App Store** and **Google Play Store**.

### Mobile Features

| Feature | Implementation |
| --- | --- |
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
| --- | --- | --- |
| `app.json` | `extra.eas.projectId` | Replace `YOUR_EAS_PROJECT_ID` with output of `eas init` |
| `eas.json` | `submit.production.ios.*` | Apple ID, ASC App ID, Apple Team ID |
| `eas.json` | `submit.production.android.serviceAccountKeyPath` | Path to Google service account JSON |
| `assets/images/` | `icon.png` | 1024×1024 PNG |
| `assets/images/` | `splash.png` | 1284×2778 PNG (iPhone 12 Pro Max) |
| `assets/images/` | `adaptive-icon.png` | 1024×1024 PNG (foreground layer) |

---

## Environment Setup

Generate all required secrets before first run:

```bash
# Required secrets (add to .env)
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 48   # INTERNAL_API_SECRET   (shared by backend + all 6 AI services)
openssl rand -base64 32   # ENCRYPTION_KEY
openssl rand -base64 32   # REDIS_PASSWORD
```

All variables are documented in `.env.example` with descriptions and required/optional markers. Docker Compose will refuse to start if any required variable is missing — this is intentional.

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
| --- | --- | --- |
| Brand | `brand@demo.conic.io` | Demo@Conic2025! |
| Creator 1 | `creator1@demo.conic.io` | Demo@Conic2025! |
| Creator 2 | `creator2@demo.conic.io` | Demo@Conic2025! |
| Admin | `admin@demo.conic.io` | Demo@Conic2025! |

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

## NIL Compliance Engine

Conic is purpose-built for the post-NIL era. Every participating athlete flows through a compliance pipeline from eligibility verification to deal disclosure to tax documentation.

### Roles

| Role | Description |
| --- | --- |
| `ATHLETE` | College/NAIA athlete — NIL Hub, deals, disclosures, earnings |
| `GUARDIAN` | Parent/guardian — approval workflow for minors |
| `AGENT` | Certified agent — athlete representation, multi-client view |
| `COMPLIANCE_OFFICER` | University compliance staff — review disclosures, flag issues |
| `UNIVERSITY_ADMIN` | Athletic department admin — reporting, rosters, school cap |
| `ATHLETIC_DIRECTOR` | Department oversight — aggregate reports, policy management |

### NIL Modules

| Module | Endpoints | Purpose |
| --- | --- | --- |
| `nil-compliance` | analyze disclosure, assess risk, check eligibility, FMV | AI-powered compliance review |
| `university` | manage universities, rosters, caps | School administration |
| `guardian` | approvals, relationships, notices | Minor athlete oversight |
| `agent-profile` | CRUD, representations, verification | Agent management |
| `nil-marketplace` | search, list, inquire, admin verify | Athlete discovery |
| `tax-documents` | request, submit, verify, summary | W-9 / 1099-NEC lifecycle |

### NIL AI Service (Port 8007)

| Endpoint | Description |
| --- | --- |
| `POST /compliance/analyze-disclosure` | GPT-4o-mini NIL disclosure analysis — flags, violations, suggestions |
| `POST /compliance/assess-deal-risk` | 0-100 risk score with NCAA/state rule cross-check |
| `POST /compliance/check-eligibility` | eligible / at_risk / probation / ineligible verdict |
| `POST /fmv/assess` | Fair Market Value range (low/mid/high) for any deal type |
| `POST /reports/generate-narrative` | Human-readable compliance report for compliance officer, university, or athlete |

---

## Fraud Detection AI (Port 8008)

No competitor has a purpose-built fraud detection service integrated into their payment and partnership
flow. Conic's `fraud-detection-ai` runs three independent analysis engines combined into a single 0-100
fraud score.

### Endpoints

| Endpoint | Description |
| --- | --- |
| `POST /fraud/analyze` | Composite fraud score — fake followers, engagement manipulation, payment anomalies |
| `POST /identity/check` | Cross-platform identity consistency, bot pattern detection, impersonation signals |
| `POST /engagement/analyze` | Statistical time-series analysis — z-score spikes, coefficient of variation, pod detection |

### Signals Detected

| Signal | Method |
| --- | --- |
| Fake followers | Engagement rate vs platform benchmark, following/follower ratio, sudden spikes |
| Engagement pods | Abnormally low comment/like ratio, suspiciously uniform engagement (CoV < 0.2) |
| Purchased video views | Like/view ratio outliers on TikTok and YouTube |
| New-account inflation | High follower counts on accounts < 180 days old |
| Payment structuring | Payments clustered below $10k BSA threshold |
| Round-number clustering | >70% round-dollar payments |
| Identity mismatch | Display name vs legal name similarity, cross-platform name inconsistency |
| Bot-pattern handles | Regex detection of numeric-suffix and random-char handles |

---

## NIL Marketplace

Brands and agencies discover verified college athletes directly on the platform — no intermediary.

### Features

- **Athlete listing** — athletes control visibility, headline, bio, preferred deal types, minimum deal value
- **Brand discovery** — filter by sport, deal type, follower count; paginated results
- **Verified badge** — platform-verified athletes surface first in search
- **FMV display** — AI-assessed floor/ceiling shown on every listing card
- **Inquiry tracking** — brands record interest; athletes see inquiry count
- **View analytics** — listing impressions tracked per search and profile load

---

## API Key Management

Enterprise customers and agencies can integrate Conic into their own systems via API keys.

### Features

- Keys generated with `crypto.randomBytes` — `sk_live_<40 hex chars>`
- SHA-256 hash stored in database — raw key shown exactly once at creation
- Granular scopes: `read:contracts`, `write:campaigns`, `read:nil`, `write:nil`, etc.
- Per-key request counter — usage analytics in the admin UI
- Expiry dates supported — time-bounded integrations
- `validateAndTrack` method for use in auth guards — fire-and-forget usage tracking (non-blocking)

---

## Data Import (Switching Cost Moat)

Migrating from competitors is one click. Conic accepts Opendorse exports, Teamworks exports, and generic CSV for creators and athletes.

### Supported Import Types

| Type | Source | Fields |
| --- | --- | --- |
| `CREATOR_CSV` | Any | email, first_name, last_name, followers_count, engagement_rate, niche |
| `ATHLETE_CSV` | Any | email, first_name, last_name, sport, position, followers_count |
| `OPENDORSE_EXPORT` | Opendorse | Same as ATHLETE_CSV |
| `TEAMWORKS_EXPORT` | Teamworks | Same as ATHLETE_CSV |
| `CONTRACT_CSV` | Any | Bulk contract reference import |
| `NIL_DEAL_CSV` | Any | Historical NIL deal import |
| `GENERIC_CSV` | Any | Custom column mapping via `mappingConfig` |

Jobs track `totalRows`, `processedRows`, `errorRows` with per-row error details. Final status: `COMPLETED`, `PARTIAL`, or `FAILED`.

---

## Contract Template Library

Teams build reusable, AI-enriched contract templates with clause libraries. Templates are tagged, risk-scored, and optionally public (marketplace) or private.

- NIL-specific flag (`isNilTemplate`) — surfaced separately in the athlete and agent flows
- `POST /:id/ai-suggestions` — calls contract-ai to suggest clauses based on template category and deal context
- Usage counter increments on every `POST /:id/use` — surfaces most-used templates first in search

---

All AI subsystems are controlled by a single hierarchical command layer:

```text
Level 1  UnifiedAIOrchestrator   absolute authority — routes, merges, arbitrates
Level 2  AiService (NestJS)      narrow execution only — no independent decisions
Level 3  Python Microservices    pure inference engines
```

**Single API endpoint for all AI operations:**

```text
POST /api/v1/ai/execute
{ "taskType": "...", "payload": { ... }, "context": { ... } }
```

### Supported Task Types

| Task | Modules | Execution Mode |
| --- | --- | --- |
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
| --- | --- | --- |
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

### Docker Compose (Local — 12 services)

`postgres` · `redis` · `backend` · `frontend` · `contract-ai` · `deliverable-verification-ai` ·
`creator-graph-ai` · `pricing-engine-ai` · `campaign-agent-ai` · `performance-prediction-ai` ·
`nil-compliance-ai` · `fraud-detection-ai`

### AWS Production

```text
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
| --- | --- |
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

```text
✅  Feature-complete across web, mobile, and NIL/athlete operations
✅  Security audit complete (25 findings resolved — 13 original + 12 hardening pass)
✅  OAuth tokens secured — hash fragment redirect, never in server logs
✅  AI services fail-fast on missing credentials in production
✅  All list endpoints paginated with enforced max page size
✅  Contract creation atomic via database transaction
✅  docker-compose uses required-variable syntax — no hardcoded secrets
✅  iOS + Android app ready for App Store / Google Play submission
✅  Full observability stack (OTel + Prometheus + Grafana)
✅  Demo seed data
✅  Load and soak tests passing thresholds
✅  Transactional email (5 templates)
✅  32 unit tests passing (auth · contracts · payments · creators)
✅  NIL compliance engine (disclosure, FMV, eligibility, guardian approval)
✅  NIL Marketplace — athlete discovery with sport/deal-type/FMV filters
✅  Fraud Detection AI (port 8008) — fake followers, engagement pods, payment structuring
✅  API key ecosystem — SHA-256 hashed, scoped, revocable
✅  Contract template library with AI clause suggestions
✅  Tax document workflow (W-9/1099 request → submit → verify)
✅  Data importers — Opendorse/Teamworks migration + CSV bulk ingest
✅  8 AI microservices (ports 8001–8008) running in Docker Compose
✅  Role-aware sidebar for all 9 user roles
✅  13 NIL webhook events mapped for external delivery
✅  TypeScript: 0 errors (backend + frontend)

⏳  Pending: Dwolla live API keys (payments go live)
⏳  Pending: EAS project ID + App Store / Google Play credentials
⏳  Pending: Terraform provisioning (cloud infrastructure)
✅  ImportersController complete (create job · list jobs · get job · process CSV)
⏳  Pending: SCIM provisioning module (ScimToken model in schema, service not built)
```
