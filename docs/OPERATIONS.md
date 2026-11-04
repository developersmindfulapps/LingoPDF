# LingoPDF — Operational, Database & Security Runbook (Stage 3B.3)

This document covers environment configuration, MongoDB collection architecture, controlled index provisioning, MongoDB Atlas deployment topology and transaction guarantees, server-side admin authorization, initial admin provisioning, append-only audit logging, persistent rate limiting, proxy trust assumptions, and backup/recovery procedures for the LingoPDF website (`https://lingopdf.in`).

---

## 1. Required & Optional Environment Variables

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Canonical origin URL (`https://lingopdf.in` in production; `http://localhost:3000` in development). Used for CSRF `Origin`/`Referer` validation and transactional email links. |
| `MONGODB_URI` | **Yes** | MongoDB Atlas SRV connection string (`mongodb+srv://...`). |
| `MONGODB_DB` | **Yes** | Target database name (`lingo_pdf`). |
| `RATE_LIMIT_HMAC_SECRET` | **Yes (Prod)** | Dedicated high-entropy secret (`>= 32` characters, `>= 8` distinct characters) used to compute HMAC-SHA256 digests for IP and normalized email rate-limit bucket identifiers. Never derived from `MONGODB_URI`. Missing or invalid in production causes rate-limited endpoints to fail closed with HTTP `503`. |
| `ADMIN_EMAIL_ALLOWLIST` | Optional | Comma-separated list of normalized lowercase email addresses permitted to exercise admin privileges. When set, acts as a defense-in-depth second check in addition to `role: "admin"` in the MongoDB `users` collection. |
| `RESEND_API_KEY` | **Yes (Prod)** | Resend transactional email API key. |
| `EMAIL_FROM` | **Yes** | Verified sender address (`LingoPDF <noreply@lingopdf.in>`). |
| `EMAIL_REPLY_TO` | **Yes** | Support reply-to address (`support@lingopdf.in`). |
| `EMAIL_MOCK` | Optional | Set to `"true"` only in local/CI test environments to mock email dispatch. |
| `TRUST_CLOUDFLARE_PROXY` | Optional | Defaults to unset/`"false"`. Set to `"true"` **only** if Cloudflare is configured as an authenticated reverse proxy in front of the origin and direct origin access bypassing Cloudflare is blocked. |
| `NEXT_PUBLIC_CHROME_WEB_STORE_URL` | Optional | Chrome Web Store listing URL. When empty, extension install CTAs display `"Coming soon"`. |

---

## 2. MongoDB Collections, Responsibilities & Relationships

All 13 collections reside in the single `lingo_pdf` database on the existing MongoDB Atlas cluster (`src/lib/db/models.ts`, `src/lib/db/repositories.ts`):

| Collection | Primary Responsibility | Key Relationships & Invariants |
| :--- | :--- | :--- |
| `users` | Customer and administrator identity, Argon2id password hashes, verification/reset token hashes, account status (`"active" \| "suspended"`), and role (`"customer" \| "admin"`, defaulting to `"customer"`). | Referenced by `sessions.userId`, `purchases.userId`, `entitlements.userId`, `referral_profiles.userId`, and `admin_audit_logs.actorUserId`. |
| `sessions` | Server-side opaque session records storing `tokenHash` (SHA-256), `userId`, `expiresAt`, and `lastActiveAt`. | `userId -> users._id`. Automatically purged after `expiresAt` via TTL index. |
| `rate_limits` | Persistent fixed-window rate-limit counters keyed by HMAC-SHA256 IP or email digests (`_id`). | Evaluated atomically using MongoDB `$$NOW`. Purged automatically after `resetAt` via TTL index. |
| `purchases` | Authoritative financial transaction records (`pending`, `captured`, `refunded`, `partially_refunded`, `disputed`, `chargeback_lost`, `failed`), regional currency (`INR \| USD \| EUR`), and pricing snapshots in integer minor units. | `userId -> users._id`; optional `referrerUserId -> users._id` and `referralProfileId -> referral_profiles._id`. Promotional (`5%`, `10%`, `15%`, `20%`) and referral (`10%`) discounts **never stack**. `idempotencyKey` is mandatory at creation; `providerOrderId` and `providerPaymentId` are optional until provider order/payment steps and enforced unique when populated as strings. |
| `entitlements` | Per-edition license entitlements (`active`, `suspended`, `revoked`), independent restriction tracking (`activeRestrictionReasons`), and 1-device activation binding (`maxActiveDevices: 1`). | `purchaseId -> purchases._id` (`1:1` unique). `{ userId: 1, productSlug: 1 }` is unique across non-revoked (`"active"` and `"suspended"`) entitlements so historical `"revoked"` entitlements are preserved if a user legitimately repurchases later. Resolving one restriction never restores `status: "active"` while another restriction remains present. |
| `promotion_settings` | Singleton configuration document (`_id: "global_referral_promo"`) controlling `"promo"` vs `"normal"` mode, promotional discount (`5%`, `10%`, `15%`, or `20%`), fixed `10%` referral buyer discount, fixed `10%` referrer commission, `50`-referral cap, exact `72`-hour hold window, and `5`-commission minimum payout eligibility threshold. | `updatedByAdminId -> users._id`. |
| `referral_profiles` | Referrer eligibility profile created only after a user has a qualifying captured purchase. Tracks `referralCode`, `pendingReservedCount`, `successfulConversionsCount` (`<= 50`), and payout method. | `userId -> users._id` (`1:1` unique); `qualifyingPurchaseId -> purchases._id` (`1:1` unique). |
| `commissions` | Individual referral commission ledger entries (`pending`, `eligible`, `approved`, `paid`, `cancelled`) in the purchase's original currency (`10%` of actual purchase amount paid after discounts) with an exact `72`-hour `holdUntil` window measured from `purchaseCapturedAt`. | `purchaseId -> purchases._id` (`1:1` unique); `referrerUserId -> users._id`; `referredUserId -> users._id`; optional `payoutId -> payouts._id`. Disputed unpaid commissions remain on hold (`isDisputedHold: true`). `"paid"` commissions are strictly terminal and can **never** be automatically cancelled or clawed back. |
| `payouts` | Single-currency manual payout batches (`draft`, `approved`, `processing`, `paid`, `failed`, `cancelled`) grouping approved commissions for a single referrer. | `referrerUserId -> users._id`; `commissionIds -> commissions._id[]`; `createdByAdminId -> users._id`. Payout eligibility requires at least `5` eligible/approved commissions across all currencies combined; individual payout batches never mix `INR`, `USD`, and `EUR`. |
| `payment_webhooks` | Deduplicated, signature-verified payment provider webhook ledger keyed by `(provider, eventId)`. | Prevents replay/duplicate webhook execution. Ingestion fields (`provider`, `eventId`, `payloadHash`, `signatureVerified`, `receivedAt`) are immutable. |
| `admin_audit_logs` | Append-only audit trail of all privileged admin actions (`outcome: "success" \| "failure"`), actor identity, target entity, correlation ID, and redacted metadata. | `actorUserId -> users._id`. **No TTL index**; protected against update/delete in application flows via `getAdminAuditLogsCollection` and `getProtectedAdminAuditLogsCollection`. |
| `purchase_evidence` | Dispute and compliance evidence snapshot captured at purchase completion (checkout pricing, legal/refund policy version acceptance, payment method summary, activation timestamps). | `purchaseId -> purchases._id` (`1:1` unique); `providerPaymentId` unique. **Never stores raw card PAN or CVV**; **no TTL index**. |
| `commission_adjustments` | Post-payout accounting adjustments (`open`, `offset_applied`, `waived`, `written_off`) when a purchase associated with an already-`"paid"` commission is later refunded or lost to a chargeback. | `commissionId -> commissions._id` (`1:1` unique); `purchaseId -> purchases._id`; `payoutId -> payouts._id`. |

---

## 3. Controlled Database Index Provisioning (`npm run db:indexes`)

Runtime collection accessors in `src/lib/db/models.ts` **never** execute `createIndex` during serverless request handling. All `43` indexes across the `13` collections are provisioned explicitly via:

```bash
npm run db:indexes
```

### Complete Provisioned Index Catalog (`43` Indexes)

1. **`users` (`4` indexes):**
   - `{ email: 1 }` (`unique: true`)
   - `{ emailVerificationTokenHash: 1 }` (`unique: true, sparse: true`)
   - `{ passwordResetTokenHash: 1 }` (`unique: true, sparse: true`)
   - `{ role: 1, status: 1 }`
2. **`sessions` (`3` indexes):**
   - `{ userId: 1 }`
   - `{ tokenHash: 1 }` (`unique: true`)
   - `{ expiresAt: 1 }` (`expireAfterSeconds: 0` TTL)
3. **`rate_limits` (`1` index):**
   - `{ resetAt: 1 }` (`expireAfterSeconds: 0` TTL)
4. **`purchases` (`6` indexes):**
   - `{ providerOrderId: 1 }` (`unique: true`, `partialFilterExpression: { providerOrderId: { $type: "string" } }`)
   - `{ providerPaymentId: 1 }` (`unique: true`, `partialFilterExpression: { providerPaymentId: { $type: "string" } }`)
   - `{ idempotencyKey: 1 }` (`unique: true`)
   - `{ userId: 1, productSlug: 1, status: 1 }`
   - `{ referrerUserId: 1, status: 1 }`
   - `{ status: 1, createdAt: -1 }`
5. **`entitlements` (`4` indexes):**
   - `{ purchaseId: 1 }` (`unique: true`)
   - `{ userId: 1, productSlug: 1 }` (`unique: true`, `partialFilterExpression: { status: { $in: ["active", "suspended"] } }`)
   - `{ status: 1, productSlug: 1 }`
   - `{ activeInstallationIdHash: 1 }` (`sparse: true`)
6. **`promotion_settings` (`1` index):**
   - `{ mode: 1, updatedAt: -1 }`
7. **`referral_profiles` (`4` indexes):**
   - `{ userId: 1 }` (`unique: true`)
   - `{ referralCode: 1 }` (`unique: true`)
   - `{ qualifyingPurchaseId: 1 }` (`unique: true`)
   - `{ status: 1, successfulConversionsCount: -1 }`
8. **`commissions` (`4` indexes):**
   - `{ purchaseId: 1 }` (`unique: true`)
   - `{ referrerUserId: 1, currency: 1, status: 1 }`
   - `{ status: 1, holdUntil: 1 }`
   - `{ payoutId: 1 }` (`sparse: true`)
9. **`payouts` (`3` indexes):**
   - `{ referrerUserId: 1, currency: 1, status: 1 }`
   - `{ status: 1, createdAt: -1 }`
   - `{ externalTransferReference: 1 }` (`unique: true`, `partialFilterExpression: { externalTransferReference: { $type: "string" } }`)
10. **`payment_webhooks` (`3` indexes):**
    - `{ provider: 1, eventId: 1 }` (`unique: true`)
    - `{ processingStatus: 1, receivedAt: 1 }`
    - `{ relatedPaymentId: 1 }` (`sparse: true`)
11. **`admin_audit_logs` (`4` indexes — NO TTL index):**
    - `{ actorUserId: 1, createdAt: -1 }`
    - `{ targetCollection: 1, targetId: 1, createdAt: -1 }`
    - `{ action: 1, createdAt: -1 }`
    - `{ correlationId: 1 }`
12. **`purchase_evidence` (`3` indexes — NO TTL index):**
    - `{ purchaseId: 1 }` (`unique: true`)
    - `{ providerPaymentId: 1 }` (`unique: true`)
    - `{ userId: 1, createdAt: -1 }`
13. **`commission_adjustments` (`3` indexes):**
    - `{ commissionId: 1 }` (`unique: true`)
    - `{ referrerUserId: 1, currency: 1, resolutionStatus: 1 }`
    - `{ purchaseId: 1 }`

---

## 4. MongoDB Atlas Topology & Transaction Verification Findings

### Verified Deployment Topology (`lingo_pdf`)
Inspection of the live MongoDB Atlas deployment via `db.command({ hello: 1 })` (`verifyDatabaseTopology` in `src/lib/db/repositories.ts`) confirmed:
- **Topology Type:** 3-Node Replica Set (`setName: "atlas-k3yp40-shard-0"`, `hostsCount: 3`, `isWritablePrimary: true`).
- **Engine & Wire Version:** MongoDB 8.0 (`maxWireVersion: 25`, `logicalSessionTimeoutMinutes: 30`).
- **Multi-Document Replica-Set Transactions:** **Supported** (`client.startSession()` + `session.withTransaction()` verified against the primary replica set with `readConcern: "majority"` and `writeConcern: { w: "majority" }`).

### Operational Concurrency & Atomicity Strategy on Atlas `M0`
Although multi-document replica-set transactions are supported on `atlas-k3yp40-shard-0`, the cluster is currently an **Atlas Free-Tier (`M0`) shared-tenant instance** (500 max connections, 60-second max transaction runtime, shared IOPS). Accordingly, LingoPDF enforces a strict two-tier atomicity strategy:

1. **Single-Document Atomic Operations & Unique Indexes (High-Contention Invariants):**
   - **Rate Limiting (`rate_limits`):** Uses single-document atomic aggregation pipeline updates (`findOneAndUpdate` with `$$NOW` and `E11000` retry) rather than multi-document transactions.
   - **Single-Use Auth Tokens (`users`):** Email verification and password reset tokens are consumed via single-document conditional `findOneAndUpdate` predicates.
   - **Webhook Deduplication (`payment_webhooks`):** Enforced via the `{ provider: 1, eventId: 1 }` unique index on insert.
   - **50-Referral Cap Reservation (`referral_profiles`):** Enforced via single-document conditional `findOneAndUpdate` (`$expr: { $lt: [{ $add: ["$pendingReservedCount", "$successfulConversionsCount"] }, "$maxReferralsCap"] }`).
   - **1-Device Activation Lock (`entitlements`):** Enforced via single-document conditional `findOneAndUpdate` on `{ _id, status: "active", $or: [{ activeInstallationIdHash: null }, { activeInstallationIdHash }] }`.
2. **Multi-Document Replica-Set Transactions (`runInReplicaSetTransaction`):**
   - Used for cross-collection financial state transitions that must commit or abort together (e.g., transitioning a `purchases` record to `"captured"` while creating its `entitlements`, `purchase_evidence`, and `commissions` records, or transitioning `payouts` + `commissions` together).
   - **No Silent Non-Atomic Fallback:** `runInReplicaSetTransaction` verifies replica-set transaction support via `verifyDatabaseTopology(db)` before opening a transaction and **throws `TopologyVerificationError`** rather than silently falling back to non-atomic writes if transactions are unavailable.

---

## 5. Admin Role, Server-Side Authorization & Initial Provisioning

### Admin Role & Authorization Model (`src/lib/auth/admin.ts`)
- **Role Representation:** `UserDocument.role` is `"customer" | "admin"`. Any user document without an explicit `role: "admin"` field (including pre-Stage-3B.3 customer accounts) resolves strictly to `"customer"` via `resolveUserRole(user)`.
- **Deny by Default:** `authorizeAdminSessionToken` and `requireAdminRequest` verify every privileged request server-side against MongoDB:
  1. Validates the `lingopdf_session` cookie token against `sessions` (`tokenHash`, non-expired `expiresAt`).
  2. Queries the live `users` document in MongoDB by `_id` (never trusts client payloads or cached claims).
  3. Requires `user.status === "active"` (`403 ADMIN_ACCESS_DENIED` if `"suspended"`).
  4. Requires `user.isEmailVerified === true` (`403 ADMIN_ACCESS_DENIED` if unverified).
  5. Requires `resolveUserRole(user) === "admin"` (`403 ADMIN_ACCESS_DENIED` if `"customer"`).
  6. If `ADMIN_EMAIL_ALLOWLIST` is configured, requires `user.email` to be present in the normalized allowlist (`403 ADMIN_ACCESS_DENIED` otherwise).
- **Client Role-Escalation Protection:**
  - `POST /api/auth/register` always creates accounts with `role: "customer"`.
  - Any request payload containing `role`, `roles`, `isAdmin`, `is_admin`, `permissions`, `adminPermissions`, `privileges`, or `accessLevel` is rejected with HTTP `403` (`code: "ROLE_ESCALATION_FORBIDDEN"`) via `detectClientRoleEscalationAttempt`.

### Initial Admin Provisioning Procedure (Stage 3B.4.1 Explicit Operator Runbook)
No user is automatically or silently promoted to `"admin"` during build, deployment, or application startup. To provision the initial administrator account:

1. **Register and Verify the Account:**
   - Register the administrator email address (e.g., `developers.mindfulapps@gmail.com`) through the standard `/register` flow and complete email verification via the verification link sent to that inbox so `isEmailVerified === true`.
2. **Execute the Explicit Provisioning Script (`scripts/provision-initial-admin.js`):**
   Run the one-time, idempotent CLI provisioning script:
   ```bash
   npm run admin:provision -- --email=developers.mindfulapps@gmail.com
   ```
   Or directly with Node:
   ```bash
   node scripts/provision-initial-admin.js --email=developers.mindfulapps@gmail.com
   ```
   - **Precondition Enforcement:** If the account does not exist or `isEmailVerified !== true`, the script refuses to fabricate verification state or create a hardcoded password, records a `"failure"` bootstrap audit entry, and instructs the operator to register and verify the email first.
   - **Idempotent Promotion:** When the account exists and `isEmailVerified === true`, `provisionInitialAdminAccount` (`src/lib/auth/bootstrapAdmin.ts`) sets `role: "admin"` and `status: "active"`, preserves the existing Argon2id `passwordHash` and all unrelated user fields, and records a dedicated bootstrap audit entry (`actorRole: "system_bootstrap"`, `actorUserId: null`, `action: "admin.bootstrap_provision"`) in the append-only `admin_audit_logs` collection.
   - **Password Setup / Rotation:** No shared or temporary password is generated. The administrator can sign in with their existing password at `/login` or use the standard Forgot Password flow (`/forgot-password`) to establish a new password via their verified email address.
3. **Optional Defense-in-Depth Allowlist (`ADMIN_EMAIL_ALLOWLIST`):**
   - When `ADMIN_EMAIL_ALLOWLIST` is unset/empty, database authorization (`role === "admin"`, `status === "active"`, `isEmailVerified === true`) governs access.
   - If `ADMIN_EMAIL_ALLOWLIST` is configured in deployment environment variables, ensure `developers.mindfulapps@gmail.com` is included in the comma-separated allowlist (`ADMIN_EMAIL_ALLOWLIST=developers.mindfulapps@gmail.com`).

---

## 6. Append-Only Admin Audit Logging & Retention (`src/lib/audit/adminAudit.ts`, `src/lib/db/models.ts`)

- **Application-Level Append-Only Enforcement vs. Database-Level Access Controls:**
  - **Application-Level Protection:** Both `getAdminAuditLogsCollection(db)` (`src/lib/db/models.ts`) and `getProtectedAdminAuditLogsCollection(db)` (`src/lib/audit/adminAudit.ts`) return a frozen `AppendOnlyAdminAuditCollection` wrapper that exposes only `insertOne`, `find`, `findOne`, and `countDocuments`, while throwing `ImmutableRecordError` on `updateOne`, `updateMany`, `replaceOne`, `findOneAndUpdate`, `findOneAndReplace`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `bulkWrite`, and `drop`. Normal application code paths cannot bypass this wrapper to mutate or delete audit entries.
  - **Database-Level Access Control Boundary:** The Next.js application connects to MongoDB Atlas using a single `MONGODB_URI` database credential that holds read/write permissions across the `lingo_pdf` database. Therefore, database-level RBAC immutability is **not** enforced on the current MongoDB Atlas `M0` cluster; a caller with raw `Db` driver access (`db.collection("admin_audit_logs")`) or direct Atlas credentials could still mutate documents at the database level unless a separate insert-only MongoDB custom role is provisioned in a dedicated tier.
- **Outcome Accuracy (`executeAuditedAdminAction`):**
  - Privileged operations wrapped in `executeAuditedAdminAction` record `outcome: "success"` **only** when the underlying operation succeeds.
  - If the operation throws an exception, `executeAuditedAdminAction` records `outcome: "failure"` along with the sanitized failure message (`metadata.failureError`) and rethrows the exception. A failed privileged action can never be recorded as `"success"`.
- **Automatic Sensitive-Field Redaction (`sanitizeAuditMetadata`):**
  - Any metadata property matching `password`, `token`, `secret`, `cookie`, `authorization`, `session`, `apiKey`, `signature`, `cvv`, `cvc`, `pan`, `cardNumber`, `bankAccount`, or `privateKey` is recursively replaced with `"[REDACTED]"`.
  - Any string value matching a 13–19 digit PAN pattern is replaced with `"[REDACTED_PAN]"`.
- **Retention Policy:**
  - `admin_audit_logs` and `purchase_evidence` intentionally have **no TTL expiration index** and must be retained indefinitely in primary storage and logical backup archives for financial reconciliation, tax compliance, and chargeback dispute defense.

---

## 7. Persistent Rate Limiting & Production Fail-Closed Behavior

Rate limiting is backed by the `rate_limits` collection in MongoDB (`src/lib/auth/rateLimit.ts`) using atomic document-level aggregation pipeline updates (`findOneAndUpdate` with `upsert: true` and MongoDB's authoritative `$$NOW` server clock).

### Approved Thresholds (15-Minute Window = 900 Seconds)

| Policy Key | Operation / Endpoint | IP Bucket Limit | Email / Account Bucket Limit |
| :--- | :--- | ---: | ---: |
| `register` | Registration (`POST /api/auth/register`) | 5 | — |
| `login` | Login (`POST /api/auth/login`) | 10 | 5 |
| `verifyEmail` | Email Verification (`GET` / `POST /api/auth/verify-email`) | 10 | — |
| `resendVerification` | Resend Verification (`POST /api/auth/resend-verification`) | 3 | 3 |
| `forgotPassword` | Forgot Password (`POST /api/auth/forgot-password`) | 5 | 3 |
| `resetPassword` | Reset Password (`POST /api/auth/reset-password`) | 10 | — |
| `logout` | Logout (`POST /api/auth/logout`) | 20 | — |
| `pricingPreference` | Currency Preference (`POST /api/pricing`) | 30 | — |

### Dedicated HMAC Secret & Fail-Closed Rules
- Production (`NODE_ENV === "production"` or `VERCEL_ENV === "production"`) requires `RATE_LIMIT_HMAC_SECRET` (`>= 32` chars, `>= 8` distinct chars).
- Never falls back to `MONGODB_URI`, a public constant, or an in-memory store in production.
- If `RATE_LIMIT_HMAC_SECRET` is missing/invalid or MongoDB is unreachable in production, `RateLimitBackendError` is thrown and endpoints fail closed with HTTP `503 Service Unavailable`.

---

## 8. Trusted Proxy Headers, Regional Pricing & CSRF Protection

- **Client IP Precedence (`getClientIp`):**
  1. `cf-connecting-ip` **only** when `TRUST_CLOUDFLARE_PROXY === "true"` (evaluated before Vercel headers; must only be enabled when direct origin access bypassing Cloudflare is blocked).
  2. `x-vercel-forwarded-for` (first hop) and `x-real-ip` **only** when `process.env.VERCEL === "1"`.
  3. Non-production fallback (`x-forwarded-for` / per-agent dev token) **only** when `NODE_ENV !== "production"` and `VERCEL_ENV !== "production"`.
  4. Returns `null` in production if no authoritative header is present (`enforceIpRateLimit` returns `400 CLIENT_IP_UNVERIFIED` with no shared fallback bucket).
- **Regional Pricing (`src/lib/pricing/resolve.ts`):**
  - India (`IN`) buyers receive `₹1,299 INR` exclusively.
  - International buyers (`detectedCountry !== "IN"`) may choose `\$59 USD` or `€59 EUR` and can never select `INR`.
- **CSRF Protection (`src/lib/security/csrf.ts`):**
  - Enforces strict `Origin`/`Referer` comparison against `NEXT_PUBLIC_APP_URL`, rejects `Sec-Fetch-Site: cross-site` and `same-site`, and requires `Content-Type: application/json` on all JSON mutation routes.

---

## 9. MongoDB Atlas Backup Status & Manual Recovery Runbook

### Current Cluster Tier Limitations (MongoDB Atlas Free Tier `M0`)
- LingoPDF currently uses the existing **MongoDB Atlas Free-tier (`M0`)** cluster (`lingo_pdf` database on `atlas-k3yp40-shard-0`).
- **Important Limitation:** MongoDB Atlas `M0` Free-tier clusters **do not include automated cloud provider snapshots or Point-in-Time Recovery (PITR)**.

### Logical Backup & Restore Runbook (`mongodump` / `mongorestore`)
1. **Create a Logical Backup Before Maintenance or Schema Changes:**
   ```bash
   mongodump --uri="$MONGODB_URI" --db=lingo_pdf --gzip --archive="lingo_pdf_backup_$(date -u +%Y%m%dT%H%M%SZ).gz"
   ```
   Store backup archives in encrypted, access-controlled off-repo storage (never commit `.gz` or `.bson` dumps to Git).
2. **Restore from a Logical Backup Archive:**
   ```bash
   mongorestore --uri="$MONGODB_URI" --nsInclude="lingo_pdf.*" --gzip --archive="lingo_pdf_backup_<timestamp>.gz"
   ```
3. **Re-Provision All 43 Indexes After a Restore:**
   ```bash
   npm run db:indexes
   ```
   Verify that all `43` indexes across the `13` collections report `✓` completion.

---

## 10. Stage 3B.4 Admin Dashboard & Operations Architecture

### 10.1 Protected Admin Route Map
All administrative pages live under `/admin/*` (`src/app/admin/`) and use a dedicated SaaS operations console shell (`src/components/admin/AdminShell.tsx`) rather than the marketing website navigation:
- `/admin` — Operational Overview (currency-segregated `INR`, `USD`, and `EUR` gross/net revenue, KPI cards, daily revenue series, operational alerts, recent purchases, registrations, and audit activity).
- `/admin/users` & `/admin/users/[id]` — User listing, search, filters, profile details, purchase/entitlement/referral/refund/dispute history, and account suspend/restore actions.
- `/admin/purchases` & `/admin/purchases/[id]` — Purchase listing, pricing snapshots, non-stacking discount verification, provider references, immutable `purchase_evidence` inspection, and support actions (no manual payment-capture button exists).
- `/admin/entitlements` — Per-language license entitlements, 1-device installation binding (`maxActiveDevices = 1`), independent restriction reasons (`refund_pending`, `chargeback_open`, `admin_suspended`), and suspend/restore/revoke/replace-device workflows.
- `/admin/refunds` — Customer refund review queue, 72-hour money-back guarantee countdown evaluation, approve (`approved_pending_gateway`) and reject workflows.
- `/admin/disputes` — Payment dispute and chargeback queue, defense evidence inspection, case notes, and won/withdrawn/lost resolution workflows.
- `/admin/promotions` — Global pricing mode (`normal` vs `promo`) and promotional campaign management strictly restricted to `5%`, `10%`, `15%`, or `20%` non-stacking discounts.
- `/admin/referrals` — Referral profile management, atomic 50-conversion cap tracking (`successfulConversionsCount + pendingReservedCount <= 50`), currency-segregated balances, risk review flags, and suspend/reinstate workflows.
- `/admin/commissions` — 20% net referral commission ledger, 72-hour eligibility verification, payout approval, and post-payout `commission_adjustments` ledger.
- `/admin/payouts` — Cross-currency 5-commission referrer eligibility readiness and single-currency (`INR`, `USD`, `EUR`) payout batch creation and status transitions.
- `/admin/audit-logs` — Read-only viewer for the append-only `admin_audit_logs` collection with filters and sanitized metadata inspection.
- `/admin/settings` — Read-only display of authoritative commercial invariants and configurable referral velocity monitoring thresholds and product edition availability flags.
- `/admin/system` — Safe operational health diagnostics (MongoDB replica-set status, 43-index verification, rate-limit status, email provider status, and deferred payment gateway status without exposing secrets).

### 10.2 Server-Side Authorization & Mutation Security
- **Page & Layout Guard (`src/lib/auth/adminServer.ts`):** Every `/admin/*` Server Component page and layout calls `verifyServerAdminPageAccess()`, which validates the `lingopdf_session` cookie against the live MongoDB `sessions` and `users` collections via `authorizeAdminSessionToken()`.
- **Unified Mutation Endpoint (`POST /api/admin/actions`):**
  1. Enforces strict CSRF origin/referer/Sec-Fetch-Site validation (`enforceCsrfProtection`).
  2. Enforces persistent MongoDB rate limiting under the `adminMutation` policy (`60` requests per `15` minutes per IP).
  3. Re-verifies live database administrator status (`role === "admin"`, `status === "active"`, `isEmailVerified === true`, plus optional `ADMIN_EMAIL_ALLOWLIST`) via `requireAdminRequest` and `assertLiveAdminActor`.
  4. Rejects any client-supplied privilege escalation fields (`detectClientRoleEscalationAttempt`).
  5. Validates all parameters with Zod (`src/lib/admin/schemas.ts`), requiring `confirmed: true` and an explicit `reason` (`5..1000` characters) for every mutation.
  6. Wraps every sensitive mutation in `executeAuditedAdminAction` (`src/lib/audit/adminAudit.ts`), recording an immutable entry in `admin_audit_logs` with `outcome: "success"` or `outcome: "failure"`.

### 10.3 Deferred Gateway Integration Boundaries (Stage 3C)
- Live Razorpay order capture, refund execution, dispute webhook ingestion, and payout transfers are intentionally deferred to Stage 3C.
- **No Fake Success States:**
  - Purchases cannot be manually clicked into `captured`.
  - Refund approvals transition to `approved_pending_gateway` (never fabricated `completed`).
  - Payout batches cannot be transitioned to `paid` from the UI without verified provider settlement evidence (`verifiedProviderEvidence`).

