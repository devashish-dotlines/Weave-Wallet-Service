# Functional Requirements — Wallet Module

**Module:** `wallet/`
**Version:** 1.0 | **Date:** July 1, 2026 | **Status:** Baseline
**URL root:** `/wallet/` (Web UI) · `/api/wallet/v1/` (REST API)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional requirements of the **Wallet module** — the
multi-currency stored-value platform of the Catena ERP. It defines what the module does
(not how it is coded) and serves as the baseline for development, testing, and user
training.

The module holds customer, partner, and internal balances; records every movement of
value in an immutable **double-entry ledger** that is the single source of truth for
balance; and posts each movement to the general ledger **inline** in the same atomic
transaction.

### 1.2 Scope

The Wallet module owns the following capability areas:

1. **Wallets & wallet types** — stored-value accounts and their configuration templates.
2. **Transactions & ledger** — credit, debit, transfer, hold/release, reversal, adjustment,
   fee, and expiry, each backed by a double-entry ledger pair.
3. **Funding & withdrawal** — inbound top-ups and outbound payouts via pluggable providers.
4. **Operational controls** — limits, velocity rules, fees, FX rates, auto-recharge.
5. **Compliance & security** — KYC, OTP/2FA, delegation, immutable audit log.
6. **Reconciliation** — external reconciliation runs, discrepancy tracking, idempotency.
7. **Inline GL posting** — synchronous double-entry posting to `accounting`.
8. **Workflow integration** — wallet, transaction, funding, and withdrawal lifecycles.
9. **Customer-facing portal** — self-service "My Wallets" for end users.
10. **Advanced features** — cashback, escrow, promo codes, referrals, tiers, virtual
    accounts, offline queue (services + API + admin; Web UI partial).

It does **not** own: the general ledger itself (`accounting`), invoicing (`billing`), or
the definition of workflow state machines (`workflow_engine`). It integrates with those
modules but the source of truth for each lives there.

### 1.3 Key Definitions

| Term | Definition |
| --- | --- |
| **Wallet** | A stored-value account holding a `balance` in one currency, owned by any entity (Customer, Partner, User) via a generic-FK owner. |
| **Wallet Type** | A configuration template (`category` = prepaid/postpaid/reward/escrow) carrying overdraft rules, required KYC level, transfer/withdrawal permissions, and a GL account code. |
| **Transaction** | The user-facing unit of movement (`WalletTransaction`); its `tx_type` and `state` drive both ledger and workflow. |
| **Ledger entry** | An immutable double-entry leg: a customer-side `LedgerEntry` plus a system-side `WalletClearingEntry` counter-leg. The cached `Wallet.balance` is recomputed from ledger entries. |
| **Hold** | Funds reserved against a pending transaction (`held_amount`), later released or captured. |
| **Funding request** | An inbound fund flow (top-up) through a channel/provider plugin. |
| **Withdrawal request** | An outbound fund flow (payout) to a bank/mobile account, subject to approval thresholds. |
| **Idempotency key** | A unique client-supplied key that guarantees a financial operation is applied at most once. |

---

## 2. Wallet Types

- **FR-WT-1** The system shall manage wallet types (configuration templates) that govern the
  behaviour of every wallet created against them.
- **FR-WT-2** A wallet type shall carry: **name**, description, **category**
  (prepaid / postpaid / reward / escrow), **overdraft-allowed** flag with optional
  **overdraft limit**, **allow-transfers-out** and **allow-withdrawals** flags, a required
  **KYC level**, a **GL account code** used for posting templates, and an active flag.
- **FR-WT-3** A wallet type's `allow_transfers_out` / `allow_withdrawals` flags and overdraft
  settings shall constrain the operations permitted on wallets of that type (FR-WL-6,
  FR-TX-4).
- **FR-WT-4** A wallet type in use shall not be deletable (referenced wallets protect it via
  `PROTECT`).

---

## 3. Wallets

### 3.1 Wallet CRUD & identity

- **FR-WL-1** The system shall list, view, and create wallets under `/wallet/`, each gated by
  the relevant model permission.
- **FR-WL-2** A wallet shall carry: a unique **code** (auto-generated, prefix `WAL`), a
  **wallet type**, a **currency**, a **generic-FK owner** (content type + object id — Customer,
  Partner, User, etc.), an optional **parent wallet** (hierarchical wallets), an optional
  display name, and audit timestamps.
- **FR-WL-3** A wallet shall maintain a cached **balance** and **held amount**, both derived
  from the ledger — never edited directly (FR-LG-3).
- **FR-WL-4** A wallet shall carry optional per-wallet controls: **min/max balance**,
  **daily/monthly debit limits**, and an **expiry** timestamp.
- **FR-WL-5** The owner of a wallet shall be resolvable and searchable via the owner-lookup
  AJAX endpoint (`/wallet/api/owner-lookup/`) so the create form can bind any supported owner
  type.

### 3.2 Wallet lifecycle & actions

- **FR-WL-6** A wallet's status shall be governed by the **`wallet` workflow**
  (pending → active → suspended / closed); balance-affecting operations shall be permitted
  only when the wallet is in an operative (active) state.
- **FR-WL-7** The wallet detail view shall expose per-wallet **action endpoints**
  (`/wallet/<pk>/action/<action>/`) for lifecycle and administrative actions, each gated by
  permission and recorded in the audit log.
- **FR-WL-8** A wallet may **expire** at `expires_at`; the `expire_wallet_balances` scheduled
  task shall process expiries and zero/settle balances per policy.

---

## 4. Transactions & Ledger

### 4.1 Transaction model

- **FR-TX-1** Every movement of value shall be recorded as a **WalletTransaction** carrying: a
  unique **code** (prefix `WTX`), **tx_type** (credit / debit / transfer / fee / reversal /
  adjustment / hold / release / expiry), **source_type** (gateway / bank / invoice / order /
  payroll / loyalty / api / system) + source reference, **from-wallet** and/or **to-wallet**,
  **amount** + currency (+ optional fx_rate), **fee / tax / net** amounts, **before/after
  balances**, a **state**, an optional **idempotency key**, an optional **parent transaction**
  (for reversals), the **GL voucher number**, description, metadata, and the initiating user.
- **FR-TX-2** A transaction's **state** (pending / approved / completed / failed / reversed /
  expired / cancelled) shall be governed by the **`wallet_transaction` workflow**; a
  transaction shall reach a balance-affecting state only through its lifecycle.
- **FR-TX-3** The core transaction operations shall be **credit, debit, transfer, hold,
  release-hold, reverse, adjust,** and **approve-pending**. Each shall be **atomic**: it
  writes the wallet transaction, writes the double-entry ledger pair, recomputes the wallet
  balance, dispatches inline GL posting (Section 7), and fires notifications — all in one DB
  transaction.

### 4.2 Balance rules

- **FR-TX-4** A **debit** (or transfer-out) shall be rejected when it would breach the
  wallet's available balance unless the wallet type permits **overdraft** within its
  **overdraft limit**; it shall also honour per-wallet min-balance and debit limits (FR-WL-4)
  and any applicable limit / velocity rules (Section 5).
- **FR-TX-5** A **hold** shall increase `held_amount` (reducing available balance) without
  changing `balance`; **release-hold** shall reverse the hold, and a captured hold shall
  convert to a debit.
- **FR-TX-6** A **reversal** shall create a compensating transaction linked to the original
  via `parent_transaction`, restore balances, and reverse the original GL voucher
  synchronously (FR-GL-4) — the original transaction shall not be mutated in place.
- **FR-TX-7** A **transfer** shall move value between two wallets as a single logical
  operation, debiting the source and crediting the destination, applying FX conversion
  (FR-CT-5) when the wallets differ in currency.

### 4.3 Idempotency

- **FR-TX-8** A transaction carrying an **idempotency key** shall be applied **at most once**;
  a repeated request with the same key shall return the original result rather than creating a
  duplicate transaction.

### 4.4 Double-entry ledger

- **FR-LG-1** Each balance-affecting transaction shall write a **double-entry ledger pair**: a
  customer-side **LedgerEntry** (debit/credit, amount, running `balance_after`) and a
  system-side **WalletClearingEntry** counter-leg against the configured clearing account
  (default `2110`).
- **FR-LG-2** Ledger entries shall be **immutable and append-only** — corrections are made by
  posting compensating entries, never by editing or deleting.
- **FR-LG-3** The cached `Wallet.balance` and `held_amount` shall be **recomputed from ledger
  entries** and treated as a derived cache; the ledger is the authoritative source of truth.

---

## 5. Operational Controls

### 5.1 Limit rules

- **FR-LM-1** The system shall manage **limit rules** under `/wallet/limit-rules/` (list,
  create, edit, delete), each gated by permission.
- **FR-LM-2** A limit rule shall scope by **wallet type**, **tx_type**, and **owner type**,
  and constrain **per-transaction min/max**, **daily max amount/count**, and **monthly max
  amount/count**, within an optional effective-from/to window.
- **FR-LM-3** A transaction that would breach an active, in-window limit rule shall be
  rejected before any ledger write.

### 5.2 Velocity rules

- **FR-VE-1** The system shall manage **velocity rules** under `/wallet/velocity-rules/`
  (list, create, edit, delete), each gated by permission.
- **FR-VE-2** A velocity rule shall scope by wallet type / tx_type / owner type and define a
  count/amount ceiling over a rolling window with an **action** (e.g. alert / block) taken
  when the threshold is crossed.

### 5.3 Fees & taxes

- **FR-FE-1** A **fee rule** shall scope by wallet type, tx_type, and channel, and compute a
  fee as flat / percentage / **tiered**, bounded by optional **min/max fee**, with an optional
  linked **tax rule** and an effective-from/to window.
- **FR-FE-2** When a fee rule applies, the transaction's **fee_amount**, **tax_amount**, and
  **net_amount** shall be computed and recorded, and the fee shall post to GL as its own leg.

### 5.4 Auto-recharge

- **FR-AR-1** An **auto-recharge rule** shall top a wallet up when its balance drops below a
  **threshold** (or on a **schedule**), drawing a configured amount from a source channel /
  tokenised source account.
- **FR-AR-2** The `process_auto_recharge` scheduled task (every 15 min) shall evaluate active
  rules and raise funding requests for those that trigger.

---

## 6. Funding & Withdrawal

### 6.1 Funding (inbound top-up)

- **FR-FR-1** The system shall manage **funding requests** under `/wallet/funding-requests/`
  (list, detail, approve/reject), each gated by permission.
- **FR-FR-2** A funding request shall carry: target **wallet**, **amount** + currency,
  **channel**, **provider plugin** + provider reference, status, requester, processor,
  optional attachment, and metadata.
- **FR-FR-3** A funding request's lifecycle shall be governed by the **`funding_request`
  workflow** (pending → processing → completed / failed / cancelled); on completion it shall
  credit the target wallet via the core credit operation (FR-TX-3).
- **FR-FR-4** Funding shall be **provider-pluggable** (`wallet/plugins/`) so new payment
  channels can be added without changing the core flow.

### 6.2 Withdrawal (outbound payout)

- **FR-WD-1** The system shall manage **withdrawal requests** under `/wallet/withdrawals/`
  (list, approve/reject), each gated by permission.
- **FR-WD-2** A withdrawal request shall carry: source **wallet**, **amount** + currency,
  **channel**, provider plugin + reference, **payout destination** (bank name, account number,
  account holder, IFSC/SWIFT, mobile number), requester, processor, and metadata.
- **FR-WD-3** A withdrawal request's lifecycle shall be governed by the **`withdrawal_request`
  workflow** (pending → approved → processing → completed / failed / cancelled).
- **FR-WD-4** A withdrawal at or above `WALLET_WITHDRAWAL_APPROVAL_THRESHOLD` shall require
  **explicit approval** before processing; approval/rejection shall be recorded with the
  deciding user.
- **FR-WD-5** A withdrawal shall be permitted only when the wallet type's `allow_withdrawals`
  flag is set and the wallet has sufficient available balance (FR-TX-4).

---

## 7. Inline GL Posting

- **FR-GL-1** Every balance-affecting wallet operation shall post to the general ledger
  **inline**, within the same atomic DB transaction as the domain write — there shall be **no
  async webhook** between the wallet and the GL.
- **FR-GL-2** The accounting bridge shall map each `WalletTransaction` to an **event type**
  (e.g. `WALLET_CREDIT`, `WALLET_DEBIT`, `WALLET_ADJUSTMENT_CREDIT/_DEBIT`) and **suffix it by
  owner key** (`_PARTNER` for partner-owned wallets, no suffix for customer-owned) so
  per-owner `PostingRules` route the liability leg to the correct GL account (customer
  liability `2100` with `customer_id` dimension; partner liability `2150` with `PARTNER`
  dimension).
- **FR-GL-3** An **invoice-payment** debit shall bypass the rule layer and post a direct
  voucher `DR wallet-liability / CR 1200 AR` with the canonical customer dimension, so a
  pay-on-behalf debit zeroes the correct customer's AR subledger.
- **FR-GL-4** A reversal shall reverse the original voucher synchronously (via
  `source_event = WTX:<code>`), never by editing the posted voucher.
- **FR-GL-5** When `WALLET_GL_POSTING_ENABLED` is `False`, posting shall be skipped and a stub
  voucher returned, so dev/test runs without a seeded CoA still succeed.

---

## 8. Compliance & Security

- **FR-KY-1** A wallet shall support **KYC records** (`WalletKYC`) carrying document type/number,
  verification status (pending / verified / …), verifier, and expiry; a wallet type's required
  **KYC level** shall gate the operations available to wallets below that level.
- **FR-SE-1** Sensitive operations shall support **OTP / 2FA** via `OTPToken`, with a
  configurable TTL (`WALLET_OTP_TTL_SECONDS`).
- **FR-SE-2** Sensitive stored fields (e.g. payout account details) shall be **encrypted** at
  rest using the configured Fernet key (`WALLET_ENCRYPTION_KEY`).
- **FR-DL-1** A wallet owner may **delegate** operational access on a wallet to another user;
  delegations shall be listable, addable, and revocable under `/wallet/<pk>/delegations/`,
  each action gated and audited.
- **FR-AU-1** Every material action on a wallet shall append an immutable **audit-log** row
  (`WalletAuditLog`) capturing actor, action, JSON details, IP address, and user agent, viewable
  under `/wallet/audit/`.

---

## 9. Reconciliation

- **FR-RC-1** The system shall run **reconciliation runs** (`/wallet/reconciliation/`) — manual
  trigger and scheduled (`run_basic_reconciliation` every 6h) — comparing internal ledger
  state against external/provider state.
- **FR-RC-2** A run shall record **discrepancies** (type, expected, actual, delta) linked to
  the affected wallet/transaction; each discrepancy shall be resolvable with a resolution note
  and resolving user (`/wallet/reconciliation/resolve/<pk>/`).
- **FR-RC-3** API idempotency records shall be retained for `WALLET_IDEMPOTENCY_TTL_HOURS` and
  purged by the `purge_idempotency_records` hourly task.

---

## 10. Customer-Facing Portal ("My Wallets")

- **FR-MY-1** End users shall access only **their own** wallets under `/wallet/my-wallets/`
  (list, detail), scoped to the authenticated user's owned wallets.
- **FR-MY-2** A user shall be able to **top up** their wallet (`/my-wallets/<pk>/topup/`) and
  **transfer** to another wallet (`/my-wallets/<pk>/transfer/`), subject to the same limit,
  velocity, KYC, and wallet-type controls as staff-initiated operations.
- **FR-MY-3** Transfer recipients shall be resolvable via the recipient-search endpoint
  (`/my-wallets/recipient-search/`) without exposing wallets the user is not permitted to see.

---

## 11. Advanced Features

- **FR-AD-1** The module shall provide **cashback**, **escrow** (with scheduled release),
  **promo codes + redemptions**, **referral** relationships, **wallet tiers**, **virtual
  accounts**, **split payments**, and an **offline transaction queue**, backed by services and
  a REST API.
- **FR-AD-2** Scheduled tasks shall maintain these features: `release_expired_escrows`
  (hourly), `expire_promo_codes` (hourly), `recompute_wallet_tiers` (daily), and
  `sync_offline_queue` (every 5 min).
- **FR-AD-3** *(Known gap)* These advanced features expose services, admin, and REST API but do
  **not** yet have a full Web UI.

---

## 12. REST API

- **FR-API-1** The module shall expose a versioned REST API under **`/api/wallet/v1/`** for
  wallets, transactions, funding/withdrawal, and advanced features, with pagination,
  throttling, and per-endpoint permissions.
- **FR-API-2** Financial-write endpoints shall honour the **idempotency key** contract
  (FR-TX-8) and record idempotency snapshots (FR-RC-3).

---

## 13. Workflow Integration

- **FR-WF-1** **Wallet**, **WalletTransaction**, **FundingRequest**, and **WithdrawalRequest**
  shall each be workflow-integrated; a newly created entity initiates its workflow and its
  denormalised `status` slug mirrors `WorkflowInstance.current_status`.
- **FR-WF-2** The denormalised `status` field shall be kept in sync automatically and shall
  **never** be edited directly.
- **FR-WF-3** The module shall provide per-workflow-type configuration pages at
  `/wallet/{wallets,transactions,withdrawals,funding-requests}/workflow/`, each gated by the
  relevant workflow-config permission; status CRUD and the transition matrix are served by the
  workflow-engine UI.
- **FR-WF-4** SLA rules (seeded by `setup_wallet_sla`) shall run on the shared SLA engine for
  time-bounded states (e.g. pending funding/withdrawal approvals).

---

## 14. Cross-cutting & Non-functional

- **NFR-1 (Authorization).** Every management view shall enforce `LoginRequiredMixin` plus the
  relevant model permission; portal views shall be scoped to the authenticated owner.
- **NFR-2 (Atomicity).** Wallet transaction, ledger pair, balance recompute, and GL posting
  shall commit or roll back **together** in one DB transaction.
- **NFR-3 (Ledger integrity).** `Wallet.balance` / `held_amount` are derived caches; the
  authoritative state is the double-entry ledger. Ledger entries are immutable and append-only.
- **NFR-4 (Idempotency & no double-spend).** No financial operation shall be applied more than
  once for a given idempotency key.
- **NFR-5 (Encryption & compliance).** Sensitive fields shall be encrypted at rest; KYC and
  OTP controls shall gate operations per wallet-type policy.
- **NFR-6 (Idempotent setup).** All `setup_wallet_*` / `seed_wallet_*` commands shall be safe
  to re-run.
- **NFR-7 (Dropdown ordering).** All create/edit dropdowns (wallet type, currency, owner, etc.)
  shall be presented **alphabetically**.
- **NFR-8 (Design consistency).** All wallet templates shall follow the Catena design system
  (data tables, badges, form-grid layout).

---

## 15. Settings

| Setting | Purpose |
| --- | --- |
| `WALLET_ENCRYPTION_KEY` | Fernet key for sensitive-field encryption. |
| `WALLET_DEFAULT_CURRENCY` | Default wallet currency. |
| `WALLET_CODE_PREFIX` / `WALLET_TRANSACTION_CODE_PREFIX` | Code prefixes (`WAL` / `WTX`). |
| `WALLET_LARGE_TX_THRESHOLD` | Threshold flagging large transactions. |
| `WALLET_WITHDRAWAL_APPROVAL_THRESHOLD` | Amount at/above which withdrawals require approval. |
| `WALLET_IDEMPOTENCY_TTL_HOURS` | Retention window for idempotency records. |
| `WALLET_OTP_TTL_SECONDS` | OTP token validity. |
| `WALLET_GL_POSTING_ENABLED` | Master toggle for the inline GL bridge. |
| `WALLET_CLEARING_ACCOUNT_CODE` | Clearing account for the ledger counter-leg (default `2110`). |

---

## 16. Module Dependencies

| Depends on | For |
| --- | --- |
| `accounting` | `Currency`; inline GL posting (`PostingRule`, `post_from_event`, `reverse_voucher`); clearing/liability accounts. |
| `accounts` | `User` / `Organization` owners; permissions. |
| `workflow_engine` | Wallet / transaction / funding / withdrawal workflows, status sync, SLA engine. |
| `notification_management` | Transaction and request notifications (email/SMS/…). |
| `billing` | Invoice-payment debits (pay-on-behalf AR settlement). |
| `partner_management` / `sales` | Partner- and customer-owned wallets and their GL routing. |
| Celery + RabbitMQ | Beat tasks (auto-recharge, expiry, reconciliation, escrow/promo/tiers/offline-queue). |
</content>
</invoke>
