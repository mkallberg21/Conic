# Conic Architecture

## Product Scope Mapped From getconic.io

Conic serves both sides of creator partnerships:
- brands that need campaign operations at scale
- creators that need transparent terms and reliable payments

Core business capabilities:
- agreement lifecycle management
- deliverable collection and proof verification
- payment orchestration on approval
- shared system of record across brand and creator teams

## Service Boundaries

1. Agreement Service
- owns agreement lifecycle, terms, and participant metadata

2. Deliverables Service
- stores evidence URLs and approval states

3. Payments Service
- schedules payout intents once deliverables are approved
- integrates provider adapters (for example Stripe, ACH rails)

4. CRM/Leads Service
- captures inbound contact requests from brands and creators

## Target Data Model

- Agreement: title, scope, amount, status, brand party, creator party
- Deliverable: agreement link, proof URL, submission timestamp, status
- Payment: linked agreement/deliverable, amount, provider, settlement date
- ContactLead: role (brand or creator), contact fields, message, timestamp

## Runtime Architecture

1. API Gateway (Fastify in current repo)
2. Domain services (application layer)
3. Persistence adapters (currently in-memory; future PostgreSQL)
4. Queue and workers for asynchronous payments (future Redis + queue workers)
5. Observability stack (future OpenTelemetry, logs, metrics)

## Production Hardening Checklist

1. Add authentication and RBAC (brand admins, creator users, finance users).
2. Add durable persistence with migrations.
3. Add idempotency keys on payout triggers.
4. Add webhook signing and replay protection.
5. Add audit logs for compliance-heavy industries.
6. Add integration and contract tests in CI.
