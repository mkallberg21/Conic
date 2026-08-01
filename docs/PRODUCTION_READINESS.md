# Production Readiness

> Honest status of what is production-safe today, what was hardened, and what still
> requires credentials or accounts you must provide. This supersedes the aspirational
> "100% complete" language in the README where the two disagree.

## Hardened in the in-repo pass

| Area | Before | Now |
| --- | --- | --- |
| **Prisma client resolution** | Generated to a custom path (`src/generated/prisma`) while all 52 files imported `@prisma/client` (empty at the default path). Compiled via a tsconfig alias but **`dist/main.js` would `require('@prisma/client')` and crash at runtime**. | Generator emits to the default `@prisma/client`. Resolves identically for tsc, jest, ts-node, and the built runtime. No alias/mapper hacks. |
| **Backend test suite** | 13 of 27 tests failing; the auth suite failed to even load. CI's backend job (no `\|\| true`) was therefore red. | **66/66 green** across 8 suites. |
| **Critical-path coverage** | 4 spec files for 30+ modules; the risk-bearing modules were untested. | **13 suites / 101 tests** (was 4 / 27). Added specs for **collective-portal, deal-room, earnings, matchmaking** (money math, fund guards, "can't accept your own proposal", role-scoped IDOR, SE-tax math), **webhooks** (dispatch + name translation), and the compliance/safety modules **guardian** (minor-approval IDOR + expiry), **deliverables** (payment-trigger event), **tax-documents** (W-9/1099 ownership + status flow), **nil-compliance** (annual NIL-cap enforcement, disclosure review). Per-file coverage thresholds ratchet the core modules so they can't silently regress (`apps/backend/package.json` → `jest.coverageThreshold`). |
| **CI honesty** | `test-ai-services` ran `pytest \|\| true` over services that have **zero tests** — it could never fail. | Replaced with a real `compileall` gate (fails on syntax/import errors) + pytest only when suites exist. Backend job now runs `test:cov` to enforce coverage thresholds. |
| **Lint gate** | `npm run lint` was red across the monorepo (backend 28 errors, `@conic/ui` 1, plus flat-config linting CommonJS build files) — CI's lint job could never pass. | **0 errors across all workspaces** (warnings remain, which don't fail CI). Dead imports/vars removed; empty-interface → type alias; build-config `.js` files excluded from lint. |
| **ts-jest config** | `TS151002` warning spam (hybrid module without `isolatedModules`). | Suppressed via ts-jest `diagnostics.ignoreCodes`. (`isolatedModules: true` was intentionally **not** set globally — it conflicts with `emitDecoratorMetadata` on NestJS controllers.) |
| **DB migrations** | `prisma/migrations/` was **empty** — the schema had never been migrated, so `prisma migrate deploy` (CI + prod) created **no tables**. | Generated the initial migration `0_init` (61 tables, 22 enums, 79 FKs, 183 indexes) from the schema via `migrate diff`. `migrate deploy` now builds the full schema on a fresh DB. |
| **Dependency CVEs (safe subset)** | 108 npm-audit vulnerabilities (3 critical, 30 high). | Applied non-breaking fixes → ~98 (2 critical). Remainder need deliberate major upgrades (below). |
| **NIL webhook dispatch** | `WebhooksService` only had `@OnEvent` listeners for 6 events; the ~15 NIL events (disclosures, deals, guardian, FMV, tax, appearances) were emitted but had **no webhook listener** — those webhooks never fired. | Replaced the hand-written handlers with a single `onModuleInit` loop that registers a listener for **every** entry in `INTERNAL_TO_WEBHOOK`, translating internal → external names. Adding a map row now auto-wires dispatch. Covered by `webhooks.service.spec.ts`. |

## Verify locally

```bash
# from repo root
npm install
npm run typecheck                              # 9/9 workspaces
cd apps/backend
npm run db:generate                            # prisma generate (default @prisma/client)
node -e "console.log(require('@prisma/client').UserRole.BRAND)"   # -> BRAND
npm run test:cov                               # 66/66 green, thresholds enforced
```

## Still required for production — needs your credentials/accounts

These are genuinely gated on secrets or account access and cannot be completed in-repo:

- [x] **e2e boot smoke test** — added (`apps/backend/test/app.e2e-spec.ts` +
  `jest-e2e.json`; the `test:e2e` script previously pointed at a non-existent config).
  It boots the whole AppModule against Postgres + Redis and hits `/api/v1/health`. It
  **cannot run in this dev environment** (no Docker/Postgres), so it is wired into CI's
  `test-backend` job (which provides both services and now runs migrations). **The first
  CI run is its real verification** — if the app needs boot env beyond what that job
  sets, the e2e will surface it there.
- [ ] **Local live boot / migrate / seed.** `docker compose up -d postgres redis`, make
  a local `.env` from `.env.example` (secrets via `openssl rand -base64 48`), then
  `npm run db:migrate` → `npm run db:seed` → start the backend and hit `/health`.

### Boot-time env the app hard-requires (found while wiring the e2e)

The app refuses to start unless these are set (beyond the DB/JWT vars in `validate`):

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — `GoogleStrategy` passes `clientID: ''`
  when unset and **passport-oauth2 throws on an empty clientID**, aborting boot.
- `SENDGRID_API_KEY` — `EmailService` calls `config.getOrThrow('email.sendgridApiKey')`
  in its constructor.
- `DWOLLA_KEY` / `DWOLLA_SECRET` — the `dwolla-v2` client is constructed at startup.
- Reachable **Postgres and Redis** (Prisma, Throttler, BullMQ connect on init).

Consider making Google/Dwolla/SendGrid init lazy or guarded so the API can boot in
environments that don't use those integrations.
- [ ] **Payments (Dwolla ACH).** `PaymentsService.release()` is wired and unit-tested against mocks, but never exercised against the real Dwolla API. Needs live keys + a platform funding source, then a sandbox integration test.
- [ ] **Infrastructure.** Terraform/K8s under `infrastructure/` is scaffolded, not provisioned. Needs AWS credentials.
- [ ] **Mobile release.** EAS Build/Submit to the App Store + Google Play needs store accounts.
- [ ] **Load testing.** The k6 suites in `tests/load/` need a deployed target to run against.

## Dependency upgrades still needed (breaking — do deliberately + test)

`npm audit fix` can't touch these without major version bumps. Prioritise the
runtime web-server one; the rest are mostly build/dev/mobile tooling:

- [ ] **`@nestjs/platform-fastify` (runtime)** — pulls the `@fastify/middie` path-bypass
  (critical) and `fastify` DoS (high) fixes. Highest priority; requires a Nest platform
  major bump and a full request-path regression test.
- [ ] **`expo`** major — clears `tar` (critical), `postcss`, `@expo/cli` highs (mobile only).
- [ ] **`@nestjs/swagger`** — clears `lodash` / `js-yaml` code-injection/prototype-pollution.
- [ ] **`@nestjs/cli`, `@opentelemetry/*`** — dev/observability tooling; lower urgency.

## Recommended next in-repo work (no credentials needed)

- [ ] Add pytest suites for the 8 Python AI services and switch the CI step back to `pytest`.
- [ ] Add a frontend test suite (none exists today).
- [ ] Extend backend coverage beyond the 8 critical modules and raise the thresholds as it climbs.
- [ ] Clean up remaining `no-explicit-any` lint warnings (backend + mobile).
