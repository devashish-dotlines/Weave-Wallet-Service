# CLAUDE.md

Guidance for Claude Code when working in this repository. These instructions OVERRIDE
default behavior — follow them exactly.

This is a **blank wallet microservice**, scaffolded from `ddd-ts-starter`: a
DDD-flavoured, layered TypeScript REST API with the framework-agnostic building blocks in place
and **no business module yet**. Build features as vertical slices following "Adding a module".

It is a **downstream service** behind APISix: it trusts the gateway-verified Keycloak token (decodes,
never re-verifies) and resolves RBAC permission codes from the **Accounts service** (the single RBAC
authority) over gRPC. It is NOT its own auth authority.

## Commands

- `npm run build` — compile `src/` → `build/` via `tsc`.
- `npm start` — `tsc -W` + `nodemon build/index.js` via `concurrently` (`--legacy-watch`).
- `npm run format` — Prettier over `src/**/*.ts`.
- `npx tsc --noEmit` — type-check without emit. **This is the only validation gate** — run it after every change. There is no test runner or lint script wired up.
- `DB_SYNC=true npm start` — runs `sequelizeConnection.sync({ alter: true })` at boot. Dev only — it mutates schema in place. Never in production.

`.env` is required at startup; it is Zod-validated in [src/config/index.ts](src/config/index.ts)
and the process throws on missing/invalid keys. See [.env.example](.env.example). Required:
`DB_USER`, `DB_PASS`, `DB_HOST`, `DB_DEV_DB_NAME`, `DB_TEST_DB_NAME`, `DB_PROD_DB_NAME`, `JWT_SECRET`.
Redis is optional, gated by `REDIS_SERVER_STATUS=true`. DB defaults to MySQL; `DB_DIALECT`/`DB_PORT` override.

## Architecture

Layered DDD. `core/` = framework-agnostic building blocks (no business logic). `infra/` =
cross-cutting wiring (Express app, Sequelize, Redis, gRPC client). Each bounded context under
`modules/<Name>/` repeats: `domain/`, `DTO/`, `mappers/`, `repos/`, `useCases/`, `infra/http/route/`,
optional `error/`. The only module present today is `Core` (shared value objects + a `/health` route).

**Dependency rule:** `core/` never imports from `modules/` or `infra/` (the one allowed exception is
`modules/Core/domain/dateTimeObject`, the shared time value object). Business rules live in `domain/`;
orchestration in `useCases/`; persistence in `repos/` + `mappers/`. Keep these boundaries.

### Request lifecycle

1. [src/index.ts](src/index.ts) imports `infra/http/app` (boots Express, listens on `config.port`),
   `infra/sequelize` (models + hooks), and calls `registerPermissionResolution()` (wires
   `Auth.permissionResolver` to the Accounts gRPC client).
2. [src/infra/http/api/v1.ts](src/infra/http/api/v1.ts) mounts `/api/v1/<module>` routers. **Auth is
   applied at the mount level** (`Auth.authenticateGateway`), not on inner route definitions. The
   `Core` health route is mounted unauthenticated.
3. A module route file wires HTTP verb → controller singleton from `useCases/<resource>/index.ts`,
   gating config endpoints with `requirePermission(code)` ([infra/permissions/permission.ts](src/infra/permissions/permission.ts)).
4. The controller (`extends BaseController`) parses `req`, builds a DTO with `requestedBy: req.user?.id`,
   calls `useCase.execute(dto)`, converts the `Either` to an HTTP response. `BaseController.handleUseCaseError`
   maps `BaseErrors.*` → status codes via an `error.constructor` switch — **add a case there when you introduce a new error class.**
5. Use cases implement `UseCase<IRequest, IResponse>` and return `Either<LeftErrors, Result<T>>`.
   `Domain.create()` failures → `BaseErrors.ValidationError`; not-found / already-exists → the matching `BaseErrors` class.
6. Repos (`extends BaseRepo`) are manually-instantiated singletons in `repos/index.ts`, injected into use cases in `useCases/<resource>/index.ts`. **No DI container** — wiring is plain top-level `new`.
7. Mappers translate domain ↔ Sequelize model. `toPersistence` returns `Partial<XxxModel>` so column typos are caught by the compiler — keep this typing.

### Auth & RBAC (downstream pattern)

- `Auth.authenticateGateway` ([src/core/middleware/auth.ts](src/core/middleware/auth.ts)) **decodes**
  the APISix-forwarded `Authorization: Bearer <jwt>` (no `jwt.verify`, no shared HMAC secret — APISix
  already verified the RS256 signature upstream), reads `sub`/`realm_access.roles`, sets `req.user`.
  For non-superusers it then resolves `req.user.permissions` via `Auth.permissionResolver`.
- `Auth.permissionResolver` is an injection seam wired at boot ([registerResolution.ts](src/infra/permissions/registerResolution.ts))
  to a gRPC client of Accounts' `PermissionService` ([permissionClient.ts](src/infra/grpc/clients/permissionClient.ts)).
  Results are cached briefly; a brief Accounts outage degrades to last-known codes, never a hard 5xx.
- `requirePermission(code)` / `hasPermission(actor, code)` ([permission.ts](src/infra/permissions/permission.ts))
  are pure in-memory checks over `req.user.permissions`. **Superusers bypass every check.** When
  `ACCOUNTS_GRPC_TARGET` is unset, the resolver is not wired and non-superusers are denied (fail-closed).
- **Security invariants:** never reintroduce `jwt.verify` with a shared secret in `authenticateGateway`;
  the gRPC client authenticates with the service `ACCOUNTS_API_KEY` (`x-api-key`), NEVER the gateway JWT;
  keep `proto/permission.proto` byte-identical to Accounts'.

### Domain conventions

- Entities extend `Entity<T>` and (for auditable rows) `AuditableEntity<T>`. `BaseEntityProps` supplies `createdAt`/`updatedAt`/`deletedAt` (as `DateTimeObject`), `createdBy`/`updatedBy`/`deletedBy`, `voided`, `serverVersion`.
- Constructors are `private`; instantiate via `static create(props, id?): Result<T>`. Validate invariants inside `create` with `Guard` and return `Result.fail(message)` on failure. **Never write a `create` that always returns `Result.ok`** — it makes the caller's failure branch dead code.
- Audit timestamps are **unix seconds in BIGINT columns**, wrapped by `DateTimeObject` ([src/modules/Core/domain/dateTimeObject.ts](src/modules/Core/domain/dateTimeObject.ts)). `DateTimeObject.create(-1)` returns "now" in the project timezone — **set your timezone once there** (currently `Asia/Dhaka`).
- In mappers, parse dates with `Mapper.toDateRequired(raw, field, entity)` / `Mapper.toDateOptional(raw)` — never call `DateTimeObject.create` inline.

### Errors & HTTP

- Errors are class instances (subclasses of `BaseErrors.*` or a module's own error namespace). They flow through `Either.left` and map to HTTP via `BaseController.handleUseCaseError`.
- Always `throw new Error(...)`, never `throw 'string'` (stack traces must survive).

## Adding a module

To add resource `Foo` in module `M` with a `create` action, generate these files (vertical slice):

```
src/modules/M/domain/foo.ts                              # entity + invariants in static create()
src/modules/M/DTO/fooDTO.ts                              # CreateFooDTO (incl. requestedBy), UpdateFooDTO, FooDTO
src/modules/M/mappers/fooMapper.ts                       # toDomain + toPersistence: Partial<FooModel>
src/modules/M/repos/interface/IMRepo.ts                  # existsFoo / createFoo / getFooById ...
src/modules/M/repos/mRepo.ts                             # extends BaseRepo implements IMRepo
src/modules/M/repos/index.ts                             # export const mRepo = new MRepo(models)
src/modules/M/useCases/foo/create/create.use-case.ts     # Either<Errors, Result<T>>, try/catch -> UnexpectedError
src/modules/M/useCases/foo/create/create.controller.ts   # extends BaseController
src/modules/M/useCases/foo/index.ts                      # instantiate + export controller singleton
src/modules/M/infra/http/route/index.ts                  # router.post('/foo', requirePermission('foo.manage'), ...)
src/infra/sequelize/models/M/foo.ts                      # decorator model
```

Then: register the model in BOTH [src/infra/sequelize/config/index.ts](src/infra/sequelize/config/index.ts) (the `models: [...]` array) and [src/infra/sequelize/models/index.ts](src/infra/sequelize/models/index.ts) (the `models` map), and mount the module router (behind `Auth.authenticateGateway`) in [src/infra/http/api/v1.ts](src/infra/http/api/v1.ts). Each file has a `// Register new module models here` / `// Mount new module routers here` marker. Permission codes used in route gates are owned and seeded by the **Accounts** service under this service's module name — register them there, not here.

### Model conventions

- `@Table({ tableName: 'snake_case_plural', underscored: true, timestamps: false })` — Sequelize timestamps OFF; audit columns are hand-managed.
- PK: `@IsUUID(4) @PrimaryKey @Column id!: string`.
- Audit: `voided` (`@Default(false)`), `createdBy/updatedBy/deletedBy`, and `createdAt/updatedAt/deletedAt` as `@Column({ type: DataType.BIGINT })` (unix seconds).

## Things the code doesn't make obvious

- `models` is typed `any` everywhere; the only persistence type-safety is the mapper's `Partial<XxxModel>` return. Keep mapper return types tight.
- Sequelize hooks and the `DomainEvents` system are scaffolded but **no-op** (bodies commented out) — don't assume domain events fire.
- `BaseRepo.delete`/`restore` do **soft** deletes (set `voided`/`deleted_at`/`deleted_by`) — don't hard-`DESTROY`.
- Multi-table writes use a transaction: `const txn = await this.models['sequelize'].transaction()`, commit/rollback, rethrow.
- This service only seeds `ServerVersion` + `APIKey` tables out of the box; add your module's models as above.
