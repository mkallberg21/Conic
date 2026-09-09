# Zero-Login Deal Intake (DealLink-style) — Implementation Spec

> **Why:** Framework NIL's DealLink is their single most copied feature — a shareable link that lets a brand, agent, guardian, or business fill deal info without creating an account, with a full audit trail. Conic's `nil-compliance/` requires `athleteId` + auth for every disclosure. That's a real acquisition friction point for schools talking to brands who don't want to sign up. This spec closes the gap without weakening Conic's auth model.

---

## What we build

A `DealLink` is a time-limited, single-use-or-renewable shareable link attached to a disclosure. Anyone with the link can submit or augment deal information without an account. The submission is attributed to a `contributorType` (BRAND | AGENT | GUARDIAN | BUSINESS | ATHLETE) and a `contributorLabel` (free text, e.g. "Nike Sportswear" or "John Smith, Father"). Every contribution is versioned and audit-logged, exactly like Framework NIL's immutable snapshots.

**Conic's version is more powerful than Framework's:** Framework handles deal collection. Conic handles deal collection **plus** automatic fan-out to the guardian approval flow if the athlete is a minor, **plus** AI compliance analysis on every submission, **plus** the disclosure still lands in the same approval queue the compliance officer already uses.

---

## API contract

### `POST /v1/nil/disclosures/:id/deal-link`

Creates (or renews) a DealLink for an existing disclosure. Returns a `linkToken` (opaque, URL-safe) and an `expiresAt`.

**Auth:** Disclosure owner (athlete, agent, compliance officer, university admin) or ADMIN.

**Request:**

```json
{
  " contributorType": "BRAND" | "AGENT" | "GUARDIAN" | "BUSINESS" | "ATHLETE",
  "contributorLabel": "Nike Sportswear (optional)",
  "maxContributions": 5,
  "expiresInHours": 168
}
```

**Response:**

```json
{
  "dealLinkId": "dl_abc123",
  "linkToken": "ck_4xYz... (opaque, URL-safe, 48 chars)",
  "submissionUrl": "https://app.conic.io/deal-link/ck_4xYz...",
  "maxContributions": 5,
  "remainingContributions": 5,
  "expiresAt": "2026-09-16T12:00:00Z"
}
```

### `POST /v1/deal-link/:linkToken/contribute`

The no-auth entry point. Anyone with a valid `linkToken` can submit deal information. No account, no login.

**Auth:** None — validated only by `linkToken` + expiry + remaining contribution count.

**Request:**

```json
{
  "dealType": "endorsement" | "appearance" | "social_post" | "licensing" | "camp_clinic" | "other",
  "brandName": "Nike Sportswear",
  "dealValueCents": 500000,
  "startDate": "2026-10-01",
  "endDate": "2026-12-31",
  "description": "3 Instagram posts + 1 story series",
  "platforms": ["instagram", "tiktok"],
  "contractUrl": "https://... (optional)",
  "supportingDocUrls": ["https://..."],
  "contributorNotes": "Posted rate based on 3-post package (optional)"
}
```

**Response:** The updated disclosure with AI analysis applied.

```json
{
  "disclosureId": "nd_xyz",
  "status": "PENDING_REVIEW",
  "aiGeneratedSummary": "...",
  "aiComplianceFlags": ["..."],
  "aiStateRules": { "requires_reporting": true, "disclosure_window_days": 30, "notes": "..." },
  "aiNcaaRules": { "allowed": true, "restrictions": [], "notes": "..." },
  "riskLevel": "low",
  "latestContributor": {
    "contributorType": "BRAND",
    "contributorLabel": "Nike Sportswear"
  }
}
```

**Behavior:**

- If the disclosure exists: contributions merge into the existing disclosure (fields are additive — first submission sets the base, subsequent submissions can add platforms, docs, notes). Status stays `PENDING_REVIEW` unless it was already approved/rejected (then contributions are logged but don't change status).
- If the disclosure doesn't exist yet (link was created for a "pre-disclosure" intake): the first contribution creates the disclosure, sets status to `PENDING_REVIEW`, and fans out to guardian approval if the athlete is a minor. **This is the feature that makes Conic's DealLink more powerful than Framework's** — Framework collects the deal; Conic collects the deal AND starts the compliance pipeline.

### `GET /v1/deal-link/:linkToken`

Returns the current state of the disclosure behind a link (read-only, no auth). Useful for the contributor to see what's already been submitted before adding their piece.

### `GET /v1/nil/disclosures/:id/deal-link`

Returns the active DealLink metadata for a disclosure (owner-only).

### `POST /v1/nil/disclosures/:id/deal-link/revoke`

Revokes a DealLink. Further `POST /contribute` calls return `410 Gone`.

### `POST /v1/nil/disclosures/:id/deal-link/renew`

Renews an expiring link (new token, fresh expiry, contribution count resets). Used when a brand is slow to come back.

---

## Data model

```prisma
model DealLink {
  id                 String   @id @default(cuid())
  disclosureId       String   @unique
  disclosure         NilDisclosure @relation(fields: [disclosureId], references: [id], onDelete: Cascade)
  linkTokenHash      String   @unique // hashed, like guardian invites
  contributorType    String   // BRAND | AGENT | GUARDIAN | BUSINESS | ATHLETE — who the link was issued to
  contributorLabel   String?
  maxContributions   Int      @default(5)
  remainingContributions Int   @default(5)
  expiresAt          DateTime
  revokedAt          DateTime?
  acceptedAt         DateTime? // first contribution
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  contributions      DealLinkContribution[]

  @@index([linkTokenHash])
}

model DealLinkContribution {
  id                String   @id @default(cuid())
  dealLinkId        String
  dealLink          DealLink @relation(fields: [dealLinkId], references: [id], onDelete: Cascade)
  contributorType   String   // BRAND | AGENT | GUARDIAN | BUSINESS | ATHLETE
  contributorLabel  String?  // free text — no account required
  ipAddress         String?
  submittedAt       DateTime @default(now())
  fields            Json     // snapshot of the submitted fields

  @@index([dealLinkId])
  @@index([submittedAt])
}
```

**Design decisions:**

- `linkTokenHash` is stored, not the raw token — same pattern as `GuardianInvite`. The raw token is shown once at creation.
- `remainingContributions` decrements on each successful `POST /contribute`. When it hits 0, further contributions return `402` (or `409` — pick one, suggest `409 Conflict` with message "contribution limit reached").
- `fields` on `DealLinkContribution` is a JSON snapshot of the submitted payload. This is the "immutable snapshot per version" that Framework NIL advertises — Conic now has it for disclosures too.
- The contribution does not overwrite the disclosure's `aiGeneratedSummary` / `aiComplianceFlags` — the AI re-runs on the merged state and updates those fields. This is the key difference from a simple form: the AI compliance analysis runs on every contribution.

---

## Guardian fan-out on first contribution

If the athlete linked to the disclosure is a minor (`athlete.isMinor === true`):

1. The first `POST /contribute` (which creates or materially updates the disclosure) triggers `guardianService.requestApproval('nil_deal', disclosureId, { athleteId })`.
2. All linked guardians receive an approval request with expiry (default 72 hours).
3. The disclosure's `status` stays `PENDING_REVIEW` until a compliance officer reviews it — the guardian approval is a parallel track, not a blocking one (same as the existing `createNilDeal` flow).

This is already implemented in `guardian/` — the DealLink just needs to call `requestApproval` at contribution time when the athlete is a minor.

---

## AI compliance re-analysis on every contribution

Every `POST /contribute` calls the existing `nil-compliance/ai` flow:

1. Merge the contribution fields into the disclosure.
2. Re-call `POST /compliance/analyze-disclosure` with the updated state.
3. Update `aiGeneratedSummary`, `aiComplianceFlags`, `aiStateRules`, `aiNcaaRules`, `riskLevel` on the disclosure.
4. If the re-analysis raises the risk level above a threshold (configurable, default `high`), emit `EVENTS.ELIGIBILITY_FLAGGED` so the compliance officer gets a signal.

This is the feature that makes Conic's DealLink more than a form — Framework NIL collects data; Conic collects data **and keeps the compliance picture current**.

---

## Audit trail

Every contribution writes an `AuditLog` entry:

```typescript
auditService.log({
  userId: null, // no authenticated user
  action: 'DEAL_LINK_CONTRIBUTION',
  resource: 'DealLink',
  resourceId: dealLink.id,
  newValue: {
    contributorType,
    contributorLabel,
    contributionId: contrib.id,
    fields: contrib.fields,
  },
  ipAddress,
});
```

The disclosure's `getResourceHistory` (existing `AuditService`) already aggregates by `resource` + `resourceId` — adding `DealLink` and `DealLinkContribution` as resource types plugs into the existing activity feed without new UI code.

---

## Frontend

Two new routes:

### `app/(dashboard)/deal-link/[linkToken]/page.tsx`

The public (no-auth) contribution page. Accessible by anyone with the link token in the URL.

- Renders a form with the same fields as `CreateDisclosureDto` (dealType, brandName, dealValueCents, startDate, endDate, description, platforms, contractUrl, supportingDocUrls, contributorNotes).
- On load: `GET /v1/deal-link/:linkToken` to populate existing values if contributions have already been made.
- On submit: `POST /v1/deal-link/:linkToken/contribute`.
- Shows a success state with a confirmation number and a "what happens next" panel: "Your contribution has been added. If the athlete is a minor, their guardian will be asked to approve. A compliance officer will review the disclosure."
- Warning badge if the link is near expiry (< 24 hours) or has 1 contribution remaining.

### `app/(dashboard)/nil-compliance/page.tsx` (existing — add DisclosureCard action)

On the existing disclosure list, each disclosure card gets a "Share DealLink" action (owner-only):

- Opens a small dialog: set `contributorType`, `contributorLabel`, `maxContributions`, `expiresInHours`.
- On submit: `POST /v1/nil/disclosures/:id/deal-link` → copy the `submissionUrl` to clipboard.
- Shows the active link status (remaining contributions, expiry) inline.
- "Revoke" button to cancel the link.

---

## Migration story for the Framework NIL comparison

When a school currently using Framework NIL evaluates Conic, the DealLink story is:

> *"Framework NIL's DealLink lets a brand fill out deal info without an account. Conic does the same — share a link, brand fills it in, no login needed. But in Conic, the moment that deal info lands, the AI runs a compliance analysis on it, the disclosure enters your review queue, and if the athlete is a minor, their guardian gets an approval request automatically. Framework collects the deal. Conic collects the deal and starts the compliance pipeline in the same step."*

---

## Out of scope for this spec

- **50-state rules database** — that's a separate spec. The DealLink feeds data into `analyze-disclosure`, which already receives `state` and `division`. Until the rules DB exists, the AI prompt handles state-specific rules from training data.
- **Versioned disclosures as a general feature** — the `DealLinkContribution.fields` snapshot gives us immutable per-version records for DealLink contributions. A full `NilDisclosureVersion` model (mirroring `ContractVersion`) is a separate, broader change.
- **Educational / SCORM curriculum** — separate spec.
- **Multi-org hierarchy** — separate spec.
