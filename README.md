# Wallet Service

A layered, DDD-flavoured Express + `sequelize-typescript` REST API for the wallet domain,
scaffolded from `ddd-ts-starter`. The framework-agnostic building blocks (`core/`) and infra wiring
(Express, Sequelize, Redis, Accounts gRPC permission client) are in place; **no business module
exists yet** — build features as vertical slices.

This is a **downstream microservice** behind APISix:

- It **decodes** (never re-verifies) the gateway-forwarded Keycloak JWT — APISix already verified it.
- It resolves RBAC permission codes from the **Accounts** service (the single authority) over gRPC,
  and gates routes with `requirePermission(code)`. Superusers bypass; fail-closed when Accounts is
  not configured.

## Quick start

```bash
npm install
cp .env.example .env        # fill in DB + JWT_SECRET (+ optional ACCOUNTS_GRPC_TARGET/ACCOUNTS_API_KEY)
DB_SYNC=true npm start      # dev only: creates the base tables on boot
```

Health check: `GET /api/v1/health` → `{ "status": "ok", "service": "wallet" }`.

See [CLAUDE.md](CLAUDE.md) for architecture, conventions, and the "Adding a module" recipe.
The service's RBAC permission codes are registered/seeded in the **Accounts** service under this
service's module name, and its `ACCOUNTS_API_KEY` is issued by Accounts via `POST /v1/accounts/services`.
