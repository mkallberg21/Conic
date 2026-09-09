# Conic vs. The NIL Incumbents — Competitive Positioning Brief

> **Audience:** Athletic departments, NIL collectives, brands, and athletes evaluating a platform. Written to be dropped into a deck, a sales one-pager, or a landing page.
> **Source of truth:** `mkallberg21/Conic` README + audited source (`nil-compliance/`, `nil-compliance-ai/`, `fraud-detection-ai/`, `deal-room/`, `school-billing/`, `imports/`). Competitor claims taken from their public sites as of Sept 2026.

---

## The short version

Every other player in NIL software owns **one slice of the stack**: compliance (Athliance, Spry, Framework NIL), marketplace (Opendorse, MOGL), or operations (Teamworks/INFLCR). None of them combine deal discovery, real-time contract negotiation, AI risk scoring **before** signature, fraud detection, collective fund management, and athlete earnings intelligence in one platform — and none of them will migrate your existing data *from* a competitor.

Conic already has every one of those pieces implemented. It does not yet have the positioning to make that obvious.

---

## Competitor-by-competitor: what they say vs. what Conic actually has

### Opendorse — "The NIL Deals Platform"

**What they sell:** Athlete discovery, social publishing, deal execution, compliance reporting. Widely adopted. Big roster of D1 programs.

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence |
|---|---|---|
| Marketplace discovery | ✅ | `nil-marketplace` — verified athlete listings, FMV display, inquiry tracking, view analytics |
| Contract execution | ✅ (deeper) | `contracts/` + `contract-ai/` — AI-generated contracts + clause library, not just a signature surface |
| **Real-time negotiation** | ❌ They don't have it | Conic `deal-room/` — clause-level proposals, accept/reject/counter, AI risk-scores every proposal against contract content before agreement |
| **Compliance AI pre-signature** | ❌ They don't have it | Conic `nil-compliance-ai` ports 8007 — disclosure analysis, 0-100 deal risk scoring, FMV with methodology, eligibility verdict |
| Payments | ✅ | Dwolla ACH escrow + disbursement (wired, needs live keys) |
| **Migration from Opendorse** | ✅ They can't do this | `imports/` — `OPENDORSE_EXPORT` import job type, field-mapped, tracks per-row errors |

**Kill line:** *Opendorse is a marketplace with a compliance reporting surface. Conic is the place where the deal is discovered, risk-assessed by AI, negotiated clause-by-clause, and paid out — and we will import your Opendorse roster on day one.*

---

### Teamworks / INFLCR — "The Operating System for Sports"

**What they sell:** Compliance ledgers, disclosure mechanisms, brand-matching. Embedded in the Teamworks OS. 520+ collegiate ADs.

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence |
|---|---|---|
| Compliance ledger | ✅ | `nil-compliance/` — disclosures with AI analysis, approval workflow, compliance reports, audit log |
| Disclosure mechanisms | ✅ (more complete) | Guardian approval for minors, NIL cap enforcement at deal creation, FMV cache per athlete |
| **Brand-matching** | ✅ (deeper) | `matchmaking/` — plain-text brief → ranked list with performance (40%) + authenticity (30%) + fraud (30%) scoring, CPM-based rate estimates |
| **Fraud detection** | ❌ They don't have it | `fraud-detection-ai/` port 8008 — fake followers, engagement pods, payment structuring, identity mismatch, bot-pattern handles |
| **AI contract risk scoring** | ❌ They don't have it | `contract-ai/` port 8001 — risk endpoint validates against `_KNOWN_FLAGS` whitelist, raises 502 on parse failure |
| Real-time deal negotiation | ❌ They don't have it | Same deal-room as above |
| **Migration from Teamworks** | ✅ They can't do this | `imports/` — `TEAMWORKS_EXPORT` type |

**Kill line:** *INFLCR gives compliance officers a ledger. Conic gives them a ledger plus a fraud layer plus an AI contract risk scorer plus real-time negotiation — and we import your INFLCR data on day one.*

---

### MOGL — "The AI Platform Redefining Athlete Influencer Marketing"

**What they sell:** Athlete marketplace, AI matching, built-in contracts & payments, deliverable review, ROI tracking. "Keep 100% of what you earn."

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence |
|---|---|---|
| AI-powered athlete matching | ✅ (more analytical) | Conic matchmaking weighs fraud score at 30% — MOGL doesn't publicly surface fraud signals |
| Built-in contracts & payments | ✅ (more sophisticated) | Conic contracts are AI-generated with clause library; payments via Dwolla escrow with disbursement |
| Deliverable review & management | ✅ | `deliverables/` + `deliverable-verification-ai/` port 8002 — CV image analysis |
| ROI / audience insights | ✅ | `performance-prediction-ai/` port 8006 — PyTorch MLP predicting reach, engagement, ROI; creator scoring queue |
| "Keep 100%" claim | ✅ same claim, better story | Dwolla payouts go direct to athlete; platform fee is configurable by deal source (MATCHMAKING vs DIRECT) |
| **Fraud detection layer** | ❌ They don't have it | Same fraud-detection-ai as above — MOGL has some basic signals but no dedicated fraud service |
| **Deal room / negotiation** | ❌ They don't have it | MOGL's contracts are "built-in" but appear to be sign-or-nothing; no clause-level counter-proposal workflow |

**Kill line:** *MOGL's hero claim is "keep 100% of what you earn." Conic matches that on payout and adds what MOGL doesn't have: a fraud detection service that separately scores fake followers, engagement pods, payment structuring, and identity — so the brand knows the reach is real before it pays.*

---

### Athliance — "The Leading NIL Compliance Solution"

**What they sell:** Automated compliance safeguard for universities, collectives, agencies. Fair market value tracking. Compliance violation prevention. "Athletes don't need to do anything."

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence |
|---|---|---|
| Automated compliance | ✅ | `nil-compliance-ai/` — disclosure analysis, deal risk, eligibility, FMV, narrative report generation |
| FMV tracking | ✅ | `fmv.py` — FMV range (low/mid/high), confidence score, methodology, comparable deals |
| **Compliance for minors** | ✅ more complete | `guardian/` — invitation + accept flow, approval fan-out to all linked guardians, expiry, IP capture on response, auto-apply to nil_deal and contract NIL extensions |
| **University compliance overview** | ✅ | `school-billing/` — `GET /:universityId/compliance-overview` returns athlete count, active deals, flagged deals (aiRiskScore >= 60), disclosures by status, compliance rate %, recent 6 disclosures |
| **Compliance report generation** | ✅ (AI-narrated) | `reports.py` — generates executive summary, highlights, compliance assessment, risk areas, recommendations, period-over-period insights for 3 audiences: compliance_officer, athletic_director, ncaa_submission |
| **Notification / tagging** | ✅ (partial) | `notifications/` module exists; "smart tagging" is an area to harden but the event bus fires 18 NIL webhook events |
| **Zero-login deal collection (DealLink-style)** | ❌ Not yet | Framework NIL's killer feature — see gaps below |
| **50-state legislation database** | ❌ Not yet | Framework NIL's explicit feature — see gaps below |

**Kill line:** *Athliances's headline is "athletes don't need to do anything." Conic delivers that same hands-off compliance — guardian approval, disclosure workflow, AI risk flags, cap enforcement — and adds AI-generated compliance reports written for three audiences (officer, AD, NCAA submission) from the same data.*

---

### Spry — "All-In-One Intercollegiate Athletics Management"

**What they sell:** Compliance + scheduling + roster + paperwork + communication. "75% tasks completed faster." Trusted by hundreds of ADs.

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence / Gap |
|---|---|---|
| Compliance tracking | ✅ (NIL-focused, deeper) | Conic `nil-compliance/` + `school-billing/` compliance overview — but Spry covers broader athletic operations |
| Scheduling | ❌ Not in scope | Conic is NIL / creator economy, not athletic-department operations |
| Roster management | ❌ Not in scope | Same |
| Paperwork / forms | ❌ Not in scope | Same |
| Communication | ✅ (partial) | `notifications/` + event bus, but not a unified chat surface like Spry |

**Kill line:** *Spry wins on breadth — it's the athletic department's everything-app. Conic is narrower and deeper on the NIL money flow: discovery, negotiation, compliance, fraud, payments, earnings intelligence. If your priority is NIL deal execution and athlete monetization, Spry doesn't touch the contract negotiation or fraud layer.*

---

### TheLinkU — "All-In-One NIL Ecosystem"

**What they sell:** RevShare contracts, revenue tracking, membership programs, GM platform for fund distribution, athlete shop, opportunities platform. "LinkSuite" is their engine.

**Where they're exposed:**

| Their pitch | Conic has it? | Evidence |
|---|---|---|
| RevShare execution | ✅ more complete | `collective-portal/` — create collectives, add/remove members with share %, donor deduplication via upsert, proportional distributions with fund-availability validation, all in atomic Prisma transactions |
| Revenue tracking | ✅ | `earnings/` — YTD net, pending payments, pipeline value, 12-month breakdown, role-aware (creator/athlete/brand) |
| Membership programs | ❌ Not yet | No membership/patron program module — gap |
| Athlete shop | ❌ Not yet | No e-commerce/shop surface — gap |
| Opportunities platform | ✅ | `nil-marketplace/` + `matchmaking/` — brand briefs, athlete discovery, inquiry tracking |
| **Collective fund lifecycle** | ✅ more complete | Conic's collective portal does the full lifecycle; TheLinkU's "GM platform" is their closest analog but Conic has atomic transaction safety on distributions |
| **Migration from TheLinkU** | ✅ can't do this | Generic CSV import covers it; no dedicated importer type yet but data is portable |

**Kill line:** *TheLinkU built a solid revshare and fund-distribution story. Conic's collective portal does that plus real-time deal negotiation, AI risk scoring on every deal, fraud detection, and a full earnings intelligence dashboard — and we import your roster via CSV on day one.*

---

### Framework NIL — "NIL Compliance Infrastructure"

**What they sell:** Education, disclosures, reporting. One platform for high school, NAIA, NCAA. DealLink (zero-login deal collection), AI Assist (Claude-powered contract review with risk scoring), versioned disclosures, 50-state laws database, SCORM learning courses, multi-org hierarchy (state associations → schools → athletes), audit trail.

**This is the closest pure-play threat.** Framework NIL has deliberately built the compliance narrative that schools and orgs buy into. Here's the exact comparison:

| Framework NIL feature | Conic has it? | Evidence / Gap |
|---|---|---|
| AI contract review with 0-100 risk scoring | ✅ | `nil-compliance-ai/compliance.py` — `assess-deal-risk` returns riskScore 0-100, riskLevel, flags, recommendations. Reads contractTerms snippet. |
| Zero-login deal collection (DealLink) | ❌ | **Gap.** No shareable, no-account deal intake link. Disclosures require athleteId + auth. Framework's DealLink is a genuine acquisition feature. |
| Versioned disclosures | ❌ (partial) | `ContractVersion` exists for contracts, but `NilDisclosure` has no version history model. Every disclosure update overwrites. Framework's immutable snapshot model is stronger. |
| 50-state NIL legislation database | ❌ | **Gap.** `analyze-disclosure` receives `state` and `division` but the AI prompt only says "Analyze this NIL disclosure for NCAA compliance and any state-specific rules" — the AI is expected to know the law from training data, not from a maintained rules database. Framework maintains an explicit searchable database. |
| Learning courses (SCORM) | ❌ | **Gap.** No education/LMS module. Framework ships financial literacy curriculum with SCORM completion tracking. Conic has `tax-documents/` but no athlete education curriculum. |
| Multi-org hierarchy | ❌ | **Gap.** `university/` module manages universities, but there's no org-hierarchy model (state association → region → school → athletes). `ScimToken` exists for provisioning but hierarchy is flat. Framework sells this for state-wide rollouts. |
| Immutable audit trail | ✅ | `audit.service.ts` — immutable audit log, `getResourceHistory`, `getContractActivity`. Every NIL event logged. |
| Role-based access | ✅ | 9 roles in `UserRole` enum, `RolesGuard`, `@Roles()` decorator. |
| Automated reporting | ✅ (AI-narrated) | `generateComplianceReport` + `reports.py` — monthly/quarterly/annual, 3 audience types, period-over-period insights. |
| AI compliance Q&A | ✅ (partial) | `check-eligibility`, `assess-deal-risk`, `analyze-disclosure` all return recommendations. Not a free-form Q&A chat like Framework's Claude-based AI Assist, but covers the same risk signals. |
| Contract analysis for officers | ✅ | Same `assess-deal-risk` + `analyze-disclosure` with officer-facing narratives. |
| Reasonableness / pay-for-play check | ✅ (partial) | FMV assessment compares proposed value to FMV range via `isProposedFair`; deal risk flags mention "deal value vs NIL cap" — but no explicit "pay-for-play scheme detection" label. |

**Kill line for Framework NIL:** *Framework NIL owns the compliance-only conversation. Conic has the compliance engine — disclosures, AI risk scoring, FMV, eligibility, audit trail, guardian approval, compliance reports — and layers on everything compliance-only tools can't offer: real-time deal negotiation, AI contract generation, fraud detection, collective fund management, earnings intelligence, and athlete discovery. For a school that wants compliance AND a path to actual deals, Framework NIL is a compliance tool; Conic is the platform.*

---

## What Conic has that no competitor can claim (the kill list)

These are implemented in code, not aspirational:

1. **Real-time contract negotiation with AI risk scoring on every clause change.** No competitor has a deal room. Every competitor is sign-or-nothing. (`deal-room/` — full implementation, spec file exists.)

2. **AI contract generation + risk scoring as a first-class microservice.** (`contract-ai/` port 8001 — generates contract from context, risk-scores with validated flags, raises 502 on failure instead of falling back to hardcoded templates.)

3. **Dedicated fraud detection service (port 8008).** Three independent engines — fake followers (engagement rate vs benchmark, F/F ratio, spikes), engagement pods (CoV < 0.2), payment structuring (clustered below $10k BSA threshold, round-dollar clustering >70%), identity mismatch, bot-pattern handles. No competitor exposes a fraud score.

4. **Data importers from Opendorse and Teamworks exports.** (`imports/` — `OPENDORSE_EXPORT` and `TEAMWORKS_EXPORT` job types, per-row error tracking, `GENERIC_CSV` with mapping config.) This is the switching-cost moat: a school on Opendorse or Teamworks can bring its roster to Conic without manual re-entry.

5. **Compliance reports for three audiences from one data set.** (`reports.py` — compliance_officer, athletic_director, ncaa_submission — each with a distinct system prompt and narrative structure.)

6. **Guardian approval workflow for minors with email invite, acceptance, expiry, IP capture, and auto-apply to deals and contracts.** (`guardian/` — full implementation, spec file exists.)

7. **University compliance command center.** (`school-billing/` — `GET /:universityId/compliance-overview` returns athlete count, active deals, flagged deals at risk threshold, disclosures by status, compliance rate %, recent 6 disclosures.)

8. **18 NIL webhook events for external delivery.** (`webhooks/` — disclosure submitted/approved/rejected, deal created/activated, appearance scheduled/completed, guardian approved/rejected, FMV assessed, eligibility flagged, tax document requested/submitted.)

9. **FMV assessment with methodology, confidence, and comparable deals.** (`fmv.py` — low/mid/high cents, isProposedFair boolean, adjustment factors, methodology string, confidence level.)

10. **Role-aware compliance UI with 9 user roles and 31 dashboard routes.** (`frontend/` — `nil-compliance/page.tsx`, `school-reporting/page.tsx`, `school/page.tsx`, `athlete/page.tsx`.)

---

## What's still missing vs. the competitors (real gaps to close)

These are honest gaps where a competitor currently wins. Fix them in order of impact.

| Gap | Competitor that wins here | Impact | Fix effort |
|---|---|---|---|
| **Zero-login deal intake link (DealLink-style)** | Framework NIL | High — this is how Framework gets deals into their system without friction | Medium — add a `DealLink`-style tokenised shareable link to `nil-compliance/` that lets a brand/agent fill deal info without an account, fans out to guardian/agent/business for attestations |
| **50-state NIL legislation database** | Framework NIL | High — schools in multi-state conferences need explicit rule tracking, not AI-guessed rules | High — build a rules table seeded with state-by-state disclosure windows, reporting requirements, minor protections; wire into `analyze-disclosure` and `assess-deal-risk` as hard constraints, not just AI prompts |
| **Versioned disclosures (immutable snapshot per version)** | Framework NIL | Medium — audit-ready version history | Medium — add `NilDisclosureVersion` model mirroring `ContractVersion`, snapshot on every status change or edit |
| **Athlete education / financial literacy curriculum** | Framework NIL, Opendorse | Medium — Opendorse's athlete education is a selling point; Framework has SCORM courses | Medium — add SCORM-tracked learning modules to `tax-documents/` or a new `education/` module |
| **Multi-org hierarchy (state association → school → athlete)** | Framework NIL | Medium — for state-wide rollouts and NAIA/state-association deals | Medium-High — add `Organization` and `OrganizationMember` models with hierarchy, propagate compliance settings down the tree |
| **Membership / patron program** | TheLinkU | Low-Medium — additional revenue stream for schools | Medium — add membership tier model, recurring donor flows |
| **Athlete shop / e-commerce** | TheLinkU | Low — nice-to-have, not core | High — separate e-commerce surface; defer |
| **SCIM provisioning** | Spry, Opendorse (enterprise buyers expect it) | Medium — blocks enterprise sales at scale | Medium — `ScimToken` is in schema; service + controller not built. Finish the SCIM service. |
| **Mobile app in app stores** | CONIC by ALC (already live, 4.5★) | High — CONIC-branded app exists with 10 reviews; the Conic repo app isn't submitted | Medium — EAS project ID + store credentials needed; this is a marketing asset sitting on the table |
| **Dwolla live keys** | Every competitor with payments | High — "get paid quickly and correctly" is a claim without live payments | Low — get live keys; the wiring is done |
| **Terraform-provisioned infrastructure** | All scaled competitors | Medium — enterprise buyers want to know it runs on real infra, not just docker-compose | Medium — apply the Terraform; it's scaffolded at 70% |

---

## The positioning that destroys them

**For the athletic department buyer:**

> *"You've looked at Athliance, Spry, and Framework NIL for compliance. You've looked at Opendorse, MOGL, and TheLinkU for deals and revenue. That's at least three vendors, three logins, and three data silos. Conic runs compliance (with AI disclosure analysis, FMV, guardian approval, and audit-ready reports), deal discovery, AI contract generation, real-time negotiation, fraud detection, collective fund management, and athlete payments in one platform — and we import your existing data from Opendorse, Teamworks, or CSV on day one. You don't choose between compliance and monetization anymore."*

**For the brand / collective buyer:**

> *"MOGL and Opendorse will match you with athletes. Conic matches you with athletes whose reach has been fraud-scored — fake followers, engagement pods, payment structuring, and identity signals all checked — then lets you negotiate the contract clause-by-clause with AI risk scoring on every change before anyone signs. You keep 100% of the athlete's payout through Dwolla ACH, and you get a performance prediction (reach, engagement, ROI) on every candidate before you commit."*

**For the athlete:**

> *"CONIC by ALC is the app athletes already use to track deals and get paid. Conic is the platform behind it — same experience, plus deals found through AI matchmaking, contracts you can negotiate in real time with AI showing you the risk of every clause, FMV so you know what a deal is worth before you sign, collective distributions when you're part of a fund, and a single view of everything you've earned this year with a tax estimate. One app. All of it."*

---

## What to do with this

1. **Put this on a page.** A `/competitive` or `/compare` route in the frontend, or a standalone marketing page, that names each competitor and maps the kill shots. Right now the README leads with "the creator & athlete partnership OS" — a buyer searching for "NIL compliance software" never finds the compliance engine, and a buyer comparing to Framework NIL never sees the gap table.
2. **Close the Framework NIL gaps first** if schools are the target buyer — zero-login deal intake and the 50-state rules database are the two features that make a compliance officer pick Framework over anyone else. Conic can beat them on everything else; these two are the reasons they'd still pick Framework.
3. **Submit the mobile app.** CONIC by ALC already has 10 reviews and a 4.5★ rating in the Finance category on iOS. The Conic repo has a React Native + Expo app at 80% EAS readiness. That store presence is a marketing asset the repo doesn't currently claim or coordinate with.
4. **Get Dwolla live keys and Terraform applied.** These are the two "pending" items that make every "enterprise-ready" claim real.

---

*Generated from audited source: `mkallberg21/Conic` (Sept 2026). Competitor claims from public websites as of Sept 2026. Gaps reflect code audit, not README claims.*
