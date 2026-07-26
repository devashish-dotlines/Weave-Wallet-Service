# Functional Requirements — Wallet Module (v1.2, First-Pass Implementation)

**Module:** `wallet/`
**Version:** 1.2 | **Date:** July 4, 2026 | **Status:** Implemented (first pass)
**Supersedes for delivered scope:** `functional-requirements-wallet.md` (v1.0 baseline)
**API root:** `/api/wallet/v1/wallet/` (public via APISix: `/api/wallet/...`)

**Changes since v1.1:** added **wallet transactions** (top-up / debit / transfer) and
**balance recompute**. The cached balance is now moved by these operations. The
double-entry **ledger** and **GL posting** remain deferred (transaction rows are the interim
source of truth).

---

## 0. About this document

This is a **scoped, as-built** revision of the v1.0 baseline. The baseline describes the
full target platform (transactions, ledger, funding/withdrawal, KYC, reconciliation,
escrow, …). This document records what the **first pass actually implements**, the
deliberate deviations from the baseline, and what is explicitly deferred.

The wallet service is a DDD-flavoured, layered TypeScript REST API (the same pattern as the
`accounting` and `accounts` services). It stands on the shared kernel (`core/`,
`modules/Core/`), the APISix/Keycloak gateway auth, and the Accounts RBAC gRPC client — all
pre-scaffolded. This pass adds the `modules/Wallet/` vertical slices.

### 0.1 Deviations from the v1.0 baseline

| # | Baseline (v1.0) | This pass (v1.2) | Rationale |
| --- | --- | --- | --- |
| D-1 | Wallet holds a **`currency`** (from `accounting.Currency`). | **UOM replaces Currency.** A wallet references a local **UOM** (unit of measure) that denominates both money and non-money value (BDT, USD, POINTS, MINUTES). No `Currency` table. | Wallets hold non-monetary value (points, minutes); UOM generalises currency and removes a cross-service dependency. |
| D-2 | Owner is a **generic FK** (`content_type` + `object_id`) with an owner-lookup AJAX endpoint. | Owner is **`ownerTypeId` (FK to a local `OwnerType` lookup) + `ownerId` (opaque string)**. No cross-service resolution of `ownerId`; no owner-lookup endpoint. | Keeps the owner reference typed and validated without coupling the wallet service to Customer/Partner/User services. |
| D-3 | Every balance-affecting operation posts to the GL **inline** (Section 7). | **No GL posting.** The accounting bridge is deferred entirely. | Descoped for the first pass. |
| D-4 | Full transaction/ledger, funding/withdrawal, holds, KYC, reconciliation, advanced features. | **Partial:** wallet **transactions** (credit/debit/transfer) + **balance recompute** are implemented (§6A). Funding/withdrawal, holds, KYC, reconciliation, advanced features remain deferred (§8). | Phased delivery. |
| D-5 | `Wallet.balance` is a **double-entry-ledger**-derived cache. | Balance **is moved** by wallet transactions and can be **recomputed** from them. Until the ledger lands, **`WalletTransaction` rows are the interim source of truth** (single-entry). `held_amount` is present but not yet moved (holds deferred). | Ledger deferred; transactions provide balance movement now. |

---

## 1. Scope (implemented)

The first pass owns these resources:

1. **Balance types** — the nature of the value a wallet holds. *(CRUD)*
2. **Units of measure (UOM)** — the unit value is denominated in (replaces Currency). *(CRUD)*
3. **Owner types** — the kind of entity that owns a wallet. *(CRUD)*
4. **Wallet types** — configuration templates. *(CRUD)*
5. **Wallets** — the stored-value accounts themselves, workflow-integrated. *(CRUD)*
6. **Wallet transactions** — balance-affecting **top-up / debit / transfer** operations plus
   **balance recompute** (§6A). Single-entry (no ledger yet); atomic balance updates.

It integrates with:

| Depends on | For |
| --- | --- |
| `accounts` | Principal identity (gateway JWT) + RBAC permission codes (resolved over gRPC). |
| `workflow_engine` | The `wallet` lifecycle: initiate on create, status projection back onto the wallet row. |

---

## 2. Balance Types

- **FR-BT-1** The system shall manage **balance types** (list, create, update, delete) under
  `/wallet/balance-types`, each gated by the matching `wallet.balance-type.*` permission.
- **FR-BT-2** A balance type shall carry: a unique **code** (stored upper-cased), a **name**,
  an optional **description**, and an **active** flag.
- **FR-BT-3** A balance type's code shall be unique among live rows; a duplicate create is
  rejected.
- **FR-BT-4** A balance type shall carry a set of **allowed UOMs** (`allowedUomIds`) — not
  every UOM is meaningful for every balance type (CASH in BDT/USD, POINTS in PTS). Each
  tagged id must reference a live UOM or the request is rejected (`404 Not Found`). An
  **empty set means unrestricted** (any UOM accepted), which is also how rows tagged before
  this field existed behave. On update the field is a **whole-list replace** when present —
  send `[]` to clear the restriction, omit it to leave the tags untouched.
- **FR-BT-5** A balance type **in use** by any wallet type shall not be deletable.

## 3. Units of Measure (UOM)

- **FR-UOM-1** The system shall manage **UOMs** (list, create, update, delete) under
  `/wallet/uoms`, each gated by the matching `wallet.uom.*` permission.
- **FR-UOM-2** A UOM shall carry: a unique **code** (upper-cased), a **name**, an optional
  **symbol**, and an **active** flag.
- **FR-UOM-3** A UOM is the unit that denominates a wallet's value (money or non-money);
  it is the first-pass replacement for the baseline's `Currency` reference (D-1).
- **FR-UOM-4** Which UOMs are applicable is scoped per balance type via the allowed-UOM
  tags (FR-BT-4); the pairing is enforced at wallet creation (FR-WL-5).

## 4. Owner Types

- **FR-OT-1** The system shall manage **owner types** (list, create, update, delete) under
  `/wallet/owner-types`, each gated by the matching `wallet.owner-type.*` permission.
- **FR-OT-2** An owner type shall carry: a unique **code** (upper-cased), a **name**, an
  optional **description**, and an **active** flag (e.g. CUSTOMER, PARTNER, USER).
- **FR-OT-3** An owner type **in use** by any wallet shall not be deletable.

## 5. Wallet Types

- **FR-WT-1** The system shall manage **wallet types** (configuration templates) under
  `/wallet/wallet-types`, each gated by `wallet.wallet-type.*`.
- **FR-WT-2** A wallet type shall carry: **name**, optional **description**, **category**
  (prepaid / postpaid / reward / escrow), a **balance type** (the nature of the value every
  wallet of this type holds), **overdraft-allowed** flag with optional
  **overdraft limit**, **allow-transfers-out** and **allow-withdrawals** flags, a
  **required KYC level** (stored only), a **GL account code** (stored only — no GL bridge
  this pass), and an **active** flag.
- **FR-WT-3** Invariants enforced on create/update: category must be one of the known set;
  the **balance type** is required and must reference a live row (`404 Not Found` otherwise);
  overdraft limit must be non-negative and only valid when overdraft is allowed; required
  KYC level must be non-negative.
- **FR-WT-4** A wallet type **in use** by any wallet shall not be deletable.

> **Enforcement status:** `allow_transfers_out` and the overdraft settings (`overdraft_allowed`
> / `overdraft_limit`) are now **enforced** by the transaction operations (§6A — transfers and
> debits). `allow_withdrawals`, `required_kyc_level`, and `gl_account_code` remain **stored
> only** (withdrawal, KYC, and GL phases are deferred).

## 6. Wallets

### 6.1 Wallet CRUD & identity

- **FR-WL-1** The system shall list, get, create, update, and delete wallets under
  `/wallet/wallets`, each gated by `wallet.wallet.*`.
- **FR-WL-2** A wallet shall carry: an auto-generated unique **code** (prefix `WAL`), a
  **wallet type** (which supplies the balance type), a **UOM**, an **owner** (`ownerTypeId` FK +
  opaque `ownerId` string), an optional **parent wallet** (self-reference), and an optional
  **display name**.
- **FR-WL-3** A wallet shall carry cached **balance** and **held amount** decimal columns
  (default 0). **Balance** is moved only by transaction operations (§6A) — never edited
  directly through the CRUD API — and can be recomputed from transaction history (FR-BAL-1).
  **Held amount** is present but not yet moved (holds deferred).
- **FR-WL-4** A wallet shall carry optional per-wallet controls: **min/max balance**,
  **daily/monthly debit limits**, and an **expiry** timestamp (stored; not yet enforced).
- **FR-WL-5** On create, the wallet's **wallet type, UOM, owner type**, and
  (if given) **parent wallet** must reference live rows, or the request is rejected
  (`404 Not Found`). The **UOM must additionally be allowed** by the balance type that the
  wallet type carries (FR-BT-4), or the request is rejected (`422` business-rule error).
  `ownerId` is stored as-is and **not** resolved against any external service.

### 6.2 Wallet code

- **FR-WL-6** The wallet **code** shall be auto-generated with prefix `WAL` and shall be
  unique; generation retries on the rare collision.

### 6.3 Wallet lifecycle (workflow-integrated)

- **FR-WL-7** A wallet's status shall be governed by the **`wallet` workflow** in the
  workflow engine. On create, the wallet **initiates** its workflow instance and the
  engine's initial status is projected onto the wallet's denormalised
  `status` / `statusId` / `statusName` / `statusColor` fields.
- **FR-WL-8** The denormalised status is a **cache of the engine's current status** and is
  **never edited directly** through the CRUD API. Update operations preserve it.
- **FR-WL-9** Workflow initiation is **best-effort at the edge**: when the engine is not
  configured (`WORKFLOW_GRPC_TARGET` / `WALLET_TYPE_ID` unset), or a transient engine call
  fails, the wallet is still created and remains at its local default status (`pending`); a
  later engine **status push** reconciles it.

---

## 6A. Wallet Transactions & Balance (no ledger yet)

Every balance movement is recorded as an immutable **WalletTransaction** row and applied to
the wallet's cached balance in **one DB transaction** (NFR-2). There is **no double-entry
ledger and no GL posting** this pass; a single `WalletTransaction` row (with a `direction`)
is the interim record from which balance is (re)computed.

- **FR-TX-1** A **WalletTransaction** shall carry: an auto **code** (prefix `WTX`), the
  affected **wallet**, a **txType** (credit / debit / transfer / adjustment), a **direction**
  (credit / debit — the sign of the balance change), an optional **counterparty wallet** (for
  transfers), the **amount**, **balance-before** / **balance-after**, a **state**
  (default `completed`), an optional **idempotency key**, an optional **parent transaction**
  (linking transfer legs), and a **description**.
- **FR-TX-2 (Top-up / credit).** `POST /wallets/:id/topup` shall credit the wallet: write a
  `credit` transaction and increase `balance`, atomically.
- **FR-TX-3 (Debit).** `POST /wallets/:id/debit` shall debit the wallet. It shall be
  **rejected** when it would take the **available** balance (`balance − held`) below the
  wallet's floor — `0`, or `−overdraft_limit` when the wallet type allows overdraft, raised by
  any per-wallet **min balance**.
- **FR-TX-4 (Transfer).** `POST /wallets/:id/transfer` shall move an amount from the path
  wallet to `toWalletId` as a **single atomic operation**: a `debit` leg on the source and a
  linked `credit` leg on the destination, both balances updated together. Both wallets must be
  operable and **share the same UOM** (no FX yet); the source **wallet type** must permit
  transfers out.
- **FR-TX-5 (Idempotency).** A transaction carrying an **idempotency key** shall be applied
  **at most once**; a repeat with the same key returns the original transaction id
  (FR-TX-8 in the baseline).
- **FR-TX-6 (Operable state).** Balance operations shall be rejected when the wallet is
  **suspended** or **closed**. (Pragmatically, `pending` and `active` are both allowed so the
  service is usable before the workflow engine is wired.)
- **FR-BAL-1 (Recompute).** `POST /wallets/:id/recompute` shall re-derive and overwrite the
  cached balance from completed transaction rows: **balance = Σ credits − Σ debits**. This is
  the interim stand-in for ledger-based recomputation and a self-heal path.
- **FR-TX-7 (History).** `GET /wallets/:id/transactions` lists a wallet's transactions
  (newest first); `GET /transactions/:txId` fetches one.

> **Not in this pass:** double-entry ledger + clearing counter-leg, GL posting, holds
> (`held_amount` movement), reversals, fees/tax, FX on transfers, per-transaction workflow
> approval, and limit/velocity rules. Transactions are created directly in `completed` state.

---

## 7. Workflow Integration

- **FR-WF-1** The wallet service integrates the **`wallet`** entity with the workflow engine
  over gRPC using the shared, entity-agnostic workflow subsystem (`infra/workflow/*`):
  outbound **initiate** on create, and an inbound **EntityStatus** push.
- **FR-WF-2** The service runs an inbound gRPC server (`npm run grpc`) hosting
  **`EntityStatusService.SyncEntityStatus`**. After the engine commits a transition it calls
  this endpoint; the service projects the new status onto the owning wallet row via the
  registered `syncStatus` hook. Best-effort: unknown entity / projection failure returns
  `{ ok: false }` and never fails the engine.
- **FR-WF-3** Inbound gRPC calls are authenticated by the caller's **service API key**
  (`x-api-key`), never the gateway JWT.
- **FR-WF-4** The `wallet` entity is registered on the workflow-entity registry at both HTTP
  boot (so initiate-on-create can resolve its workflowType id) and in the gRPC process.

---

## 8. Deferred (not in this pass)

Carried forward from the v1.0 baseline, **not implemented**:

- Inline **GL posting** and the accounting bridge (baseline §7).
- The **double-entry ledger** + clearing counter-leg (baseline §4.4). *(Single-entry
  `WalletTransaction` rows are implemented as the interim source of truth — see §6A.)*
- **Holds** (`held_amount` movement), **reversals**, **fees/tax**, **FX** on transfers, and
  per-transaction **workflow approval** (baseline §4).
- **Funding** and **withdrawal** requests and their workflows (baseline §6).
- **Limit / velocity / fee / auto-recharge** operational controls (baseline §5).
- **KYC, OTP/2FA, delegation, audit log, encryption** (baseline §8).
- **Reconciliation** (baseline §9), the **customer portal** (§10), **advanced features**
  (§11), and the broader **REST API** surface (§12) beyond the CRUD above.
- The **owner-lookup** endpoint (baseline FR-WL-5) — superseded by the `OwnerType` lookup +
  opaque `ownerId` (D-2).

---

## 9. Cross-cutting & Non-functional (as-built)

- **NFR-1 (Authorization).** Every route is gated by `requirePermission(<code>)` after the
  gateway auth middleware decodes the principal. Superusers bypass. Codes are granted in the
  Accounts authority (module `wallet` catalog) and resolved over gRPC.
- **NFR-2 (Lookups protected).** Owner types and wallet types referenced by a wallet cannot
  be deleted.
- **NFR-3 (Soft delete).** Deletes are soft (`voided` + `deleted_at` / `deleted_by`) via the
  shared `BaseRepo`.
- **NFR-4 (Idempotent setup).** The `npm run seed` command upserts default UOMs, balance types
  (with their allowed-UOM tags), and owner types keyed by natural code — safe to re-run.
  UOMs seed first, since the balance-type tags resolve them by code.
- **NFR-5 (Audit columns).** Every table carries the standard audit block
  (`voided`, `created/updated/deleted` at/by unix-seconds BIGINT, `serverVersion`).
- **NFR-6 (Validation gate).** `npx tsc --noEmit` is the sole validation gate; there is no
  test runner wired.

---

## 10. Data Model (as-built)

All tables carry the standard audit block; PKs are UUIDv4.

| Table | Key fields |
| --- | --- |
| `wlt_balance_type` | `code`* , `name`, `description?`, `is_active` |
| `wlt_uom` | `code`* , `name`, `symbol?`, `is_active` |
| `wlt_balance_type_uom` | `balance_type_id`→, `uom_id`→ — allowed-UOM tags (FR-BT-4); no live rows ⇒ unrestricted |
| `wlt_owner_type` | `code`* , `name`, `description?`, `is_active` |
| `wlt_wallet_type` | `name`, `description?`, `category`, `balance_type_id`→, `overdraft_allowed`, `overdraft_limit?`, `allow_transfers_out`, `allow_withdrawals`, `required_kyc_level`, `gl_account_code?`, `is_active` |
| `wlt_wallet` | `code`* , `wallet_type_id`→, `uom_id`→, `owner_type_id`→, `owner_id`, `parent_wallet_id?`→(self), `display_name?`, `balance`, `held_amount`, `min_balance?`, `max_balance?`, `daily_debit_limit?`, `monthly_debit_limit?`, `expires_at?`, `status`, `status_id?`, `status_name?`, `status_color?` |
| `wlt_wallet_transaction` | `code`* , `wallet_id`→, `tx_type`, `direction`, `counterparty_wallet_id?`→, `amount`, `balance_before`, `balance_after`, `state`, `idempotency_key?`* , `parent_transaction_id?`, `description?` |

`*` unique · `→` FK

---

## 11. REST API (implemented)

Base: `/api/wallet/v1/wallet`. All routes require the gateway token; each verb requires its
permission code.

| Resource | Routes | Permission prefix |
| --- | --- | --- |
| Balance types | `GET,POST /balance-types` · `PUT,DELETE /balance-types/:id` | `wallet.balance-type.*` |
| UOMs | `GET,POST /uoms` · `PUT,DELETE /uoms/:id` | `wallet.uom.*` |
| Owner types | `GET,POST /owner-types` · `PUT,DELETE /owner-types/:id` | `wallet.owner-type.*` |
| Wallet types | `GET,POST /wallet-types` · `PUT,DELETE /wallet-types/:id` | `wallet.wallet-type.*` |
| Wallets | `GET,POST /wallets` · `GET,PUT,DELETE /wallets/:id` | `wallet.wallet.*` |
| Transactions | `POST /wallets/:id/topup` · `POST /wallets/:id/debit` · `POST /wallets/:id/transfer` · `POST /wallets/:id/recompute` · `GET /wallets/:id/transactions` · `GET /transactions/:txId` | `wallet.transaction.*` (`credit` / `debit` / `transfer` / `recompute` / `read`) |

Workflow codes `wallet.wallet.workflow.read` / `.transition` are registered for the wallet
lifecycle (used by the generic workflow surface).

---

## 12. Configuration (as-built)

| Setting | Purpose |
| --- | --- |
| `DB_*` | Database connection (Sequelize). |
| `JWT_SECRET` | Decoding the gateway-forwarded JWT / local service tokens. |
| `ACCOUNTS_GRPC_TARGET`, `ACCOUNTS_API_KEY` | Accounts PermissionService client (RBAC resolution). Unset ⇒ non-superusers denied. |
| `WORKFLOW_GRPC_TARGET`, `WORKFLOW_API_KEY`, `WORKFLOW_MODULE_ID` | Workflow engine client identity. Unset ⇒ create skips initiate. |
| `WALLET_TYPE_ID` | Engine WorkflowType id for entity_type `wallet`. |
| `GRPC_PORT`, `GRPC_BIND_ADDRESS` | Inbound gRPC (EntityStatus) server (`npm run grpc`). |
| `DB_SYNC=true` | Dev-only: `sequelize.sync({ alter: true })` to materialize tables. Never in prod. |

---

## 13. Verification

- `npx tsc --noEmit` — passes (the only gate).
- `DB_SYNC=true npm start` materializes the tables in §10; `npm run seed` loads default
  UOMs / balance types (with allowed-UOM tags) / owner types (idempotent).
- CRUD each resource with a gateway token holding the relevant `wallet.*` codes (or a
  superuser). Creating a wallet returns an auto `WAL…` code and an initial `status`.
- Deleting an in-use wallet type or owner type is rejected.
- **Transactions:** top-up a wallet (balance rises), debit it (balance falls; a debit beyond
  the floor is rejected), and transfer to a second same-UOM wallet (both balances move
  atomically). Re-sending a request with the same `idempotencyKey` returns the original
  transaction id without double-applying. `POST /wallets/:id/recompute` returns
  `Σ credits − Σ debits` and rewrites the cached balance.
- With the engine configured, `npm run grpc` receives `SyncEntityStatus` pushes and updates
  the wallet's denormalised `status`.
