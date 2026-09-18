// Load .env BEFORE validating — config is imported from many places, so it must
// not depend on some other module having called dotenv.config() first.
require('dotenv').config();

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Server
  PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),

  // Database
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  DB_DIALECT: z.enum(['mysql', 'postgres', 'mariadb', 'mssql']).optional(),
  DB_DEV_DB_NAME: z.string().min(1),
  DB_TEST_DB_NAME: z.string().min(1),
  DB_PROD_DB_NAME: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().min(1).optional(),
  REDIS_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  REDIS_SERVER_STATUS: z.enum(['true', 'false']).optional(),

  // Auth / JWT. This service trusts the APISix-verified gateway token and only
  // DECODES it (see core/middleware/auth.ts). JWT_SECRET is used solely by the
  // AuthToken/crypto helpers for any locally-minted service tokens.
  JWT_SECRET: z.string().min(1),

  // IP whitelist (optional, comma-separated)
  IP_WHITELIST: z.string().optional(),

  // Accounts permission service (inter-service gRPC CLIENT). This service resolves
  // a principal's role refs → permission codes from Accounts (the single RBAC
  // authority). Unset ⇒ config-endpoint permission checks deny non-superusers.
  ACCOUNTS_GRPC_TARGET: z.string().min(1).optional(),
  ACCOUNTS_API_KEY: z.string().min(1).optional(),
  ACCOUNTS_GRPC_DEADLINE_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  PERMISSION_CACHE_TTL_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),

  // Workflow engine (inter-service gRPC CLIENT). Drives the wallet lifecycle
  // (FR-WL-6). Unset ⇒ wallet creation still works but skips initiate; wallet
  // stays at its local default status.
  WORKFLOW_GRPC_TARGET: z.string().min(1).optional(),
  WORKFLOW_API_KEY: z.string().min(1).optional(),
  WORKFLOW_MODULE_ID: z.string().min(1).optional(),
  WORKFLOW_GRPC_DEADLINE_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),

  // Per-entity workflowType id (registered onto workflowEntities at boot).
  WALLET_TYPE_ID: z.string().min(1).optional(),
  // Approval workflow for manual bank-deposit top-up requests. Unset ⇒ requests
  // can be drafted but not submitted (approval is mandatory).
  TOPUP_REQUEST_TYPE_ID: z.string().min(1).optional(),

  // Usage restrictions (what a wallet's balance may be spent on).
  //   off     — restrictions are stored and displayed, never checked (default).
  //   shadow  — checked and the would-be rejection is logged, but the spend proceeds.
  //   enforce — a spend that breaches a restriction is rejected.
  // Ships 'off': a restricted dimension missing from the usage context fails
  // CLOSED, so enforcing before every caller sends context would reject them all.
  USAGE_RESTRICTION_MODE: z.enum(['off', 'shadow', 'enforce']).optional(),

  // gRPC inbound server (EntityStatus push from the engine).
  GRPC_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  GRPC_BIND_ADDRESS: z.string().min(1).optional(),

  // --- Object storage (top-up deposit slips) ---------------------------------
  // Driver is chosen per installation: local disk for single-host installs,
  // S3-compatible (AWS/MinIO/Ceph) when object storage is available.
  STORAGE_DRIVER: z.enum(['local', 's3']).optional(),
  STORAGE_MAX_FILE_BYTES: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  STORAGE_ALLOWED_MIME: z.string().min(1).optional(),
  // MUST NOT be `media` — app.ts serves it as a public static directory, which
  // would make uploaded deposit slips world-readable.
  STORAGE_LOCAL_ROOT: z.string().min(1).optional(),
  STORAGE_S3_ENDPOINT: z.string().min(1).optional(),
  STORAGE_S3_REGION: z.string().min(1).optional(),
  STORAGE_S3_BUCKET: z.string().min(1).optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
  STORAGE_S3_PREFIX: z.string().optional(),

  // --- Configuration service (outbound gRPC: ConfigurationQueryService) ------
  // Source of top-up bank accounts and limits. Unset ⇒ top-up and self-transfer
  // are unavailable (never silently unlimited).
  CONFIG_GRPC_TARGET: z.string().min(1).optional(),
  CONFIG_API_KEY: z.string().min(1).optional(),
  CONFIG_GRPC_DEADLINE_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  CONFIG_CACHE_TTL_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),

  // --- Accounting (outbound gRPC: LedgerService) -----------------------------
  ACCOUNTING_GRPC_TARGET: z.string().min(1).optional(),
  ACCOUNTING_API_KEY: z.string().min(1).optional(),
  ACCOUNTING_GRPC_DEADLINE_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  // Post a voucher for each wallet movement. Off by default; a movement never
  // waits on or rolls back because of accounting.
  WALLET_GL_POSTING_ENABLED: z.enum(['true', 'false']).optional(),
  // GL reconciler: re-posts movements whose inline posting failed. Rows younger
  // than the min age are left to the inline post.
  GL_RECONCILE_INTERVAL_SECONDS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  GL_RECONCILE_BATCH_SIZE: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  GL_RECONCILE_RETRY_AFTER_SECONDS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  GL_RECONCILE_MIN_AGE_SECONDS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
}).superRefine((val, ctx) => {
  if (val.STORAGE_DRIVER !== 's3') return;
  const required = [
    'STORAGE_S3_REGION',
    'STORAGE_S3_BUCKET',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
  ] as const;
  for (const key of required) {
    if (!val[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when STORAGE_DRIVER is "s3"`,
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast on invalid or missing configuration
  console.error(
    'Invalid or missing environment configuration:',
    parsed.error.format(),
  );
  // Throwing here will stop the process during startup
  throw new Error(
    'Configuration validation failed. Check environment variables.',
  );
}

const env = parsed.data;

const dbDialect = env.DB_DIALECT ?? 'mysql';
const defaultDbPort = dbDialect === 'postgres' ? 5432 : 3306;
const dbPort = typeof env.DB_PORT === 'number' ? env.DB_PORT : defaultDbPort;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: typeof env.PORT === 'number' ? env.PORT : 9044,
  db: {
    development: {
      username: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_DEV_DB_NAME,
      host: env.DB_HOST,
      port: dbPort,
      dialect: dbDialect,
    },
    test: {
      username: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_TEST_DB_NAME,
      host: env.DB_HOST,
      port: dbPort,
      dialect: dbDialect,
    },
    production: {
      username: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_PROD_DB_NAME,
      host: env.DB_HOST,
      port: dbPort,
      dialect: dbDialect,
    },
  },
  redis: {
    enabled: env.REDIS_SERVER_STATUS === 'true',
    host: env.REDIS_HOST ?? '127.0.0.1',
    port: typeof env.REDIS_PORT === 'number' ? env.REDIS_PORT : 6379,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
  },
  permission: {
    // Accounts PermissionService (single RBAC authority) — gRPC client config.
    grpcTarget: env.ACCOUNTS_GRPC_TARGET ?? '',
    apiKey: env.ACCOUNTS_API_KEY ?? '',
    deadlineMs:
      typeof env.ACCOUNTS_GRPC_DEADLINE_MS === 'number'
        ? env.ACCOUNTS_GRPC_DEADLINE_MS
        : 3000,
    cacheTtlMs:
      typeof env.PERMISSION_CACHE_TTL_MS === 'number'
        ? env.PERMISSION_CACHE_TTL_MS
        : 10000,
  },
  workflow: {
    // Workflow engine gRPC client config (wallet lifecycle).
    grpcTarget: env.WORKFLOW_GRPC_TARGET ?? '',
    apiKey: env.WORKFLOW_API_KEY ?? '',
    moduleId: env.WORKFLOW_MODULE_ID ?? '',
    deadlineMs:
      typeof env.WORKFLOW_GRPC_DEADLINE_MS === 'number'
        ? env.WORKFLOW_GRPC_DEADLINE_MS
        : 10000,
    // Per-entity workflowType ids (registered onto workflowEntities at boot).
    walletTypeId: env.WALLET_TYPE_ID ?? '',
    topupRequestTypeId: env.TOPUP_REQUEST_TYPE_ID ?? '',
  },
  storage: {
    driver: env.STORAGE_DRIVER ?? 'local',
    maxFileBytes:
      typeof env.STORAGE_MAX_FILE_BYTES === 'number'
        ? env.STORAGE_MAX_FILE_BYTES
        : 10 * 1024 * 1024,
    allowedContentTypes: (
      env.STORAGE_ALLOWED_MIME ?? 'application/pdf,image/png,image/jpeg'
    )
      .split(',')
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean),
    local: {
      // NOT under `media/` — that is a public static mount.
      root: env.STORAGE_LOCAL_ROOT ?? './storage',
    },
    s3: {
      // Unset endpoint = real AWS; set it for MinIO/Ceph (with path-style on).
      endpoint: env.STORAGE_S3_ENDPOINT ?? '',
      region: env.STORAGE_S3_REGION ?? '',
      bucket: env.STORAGE_S3_BUCKET ?? '',
      accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE !== 'false',
      prefix: env.STORAGE_S3_PREFIX ?? '',
    },
  },
  configuration: {
    grpcTarget: env.CONFIG_GRPC_TARGET ?? '',
    apiKey: env.CONFIG_API_KEY ?? '',
    deadlineMs:
      typeof env.CONFIG_GRPC_DEADLINE_MS === 'number'
        ? env.CONFIG_GRPC_DEADLINE_MS
        : 3000,
    cacheTtlMs:
      typeof env.CONFIG_CACHE_TTL_MS === 'number'
        ? env.CONFIG_CACHE_TTL_MS
        : 60000,
  },
  accounting: {
    grpcTarget: env.ACCOUNTING_GRPC_TARGET ?? '',
    apiKey: env.ACCOUNTING_API_KEY ?? '',
    deadlineMs:
      typeof env.ACCOUNTING_GRPC_DEADLINE_MS === 'number'
        ? env.ACCOUNTING_GRPC_DEADLINE_MS
        : 5000,
    glPostingEnabled: env.WALLET_GL_POSTING_ENABLED === 'true',
    reconcileIntervalSeconds:
      typeof env.GL_RECONCILE_INTERVAL_SECONDS === 'number'
        ? env.GL_RECONCILE_INTERVAL_SECONDS
        : 300,
    reconcileBatchSize:
      typeof env.GL_RECONCILE_BATCH_SIZE === 'number'
        ? env.GL_RECONCILE_BATCH_SIZE
        : 50,
    reconcileRetryAfterSeconds:
      typeof env.GL_RECONCILE_RETRY_AFTER_SECONDS === 'number'
        ? env.GL_RECONCILE_RETRY_AFTER_SECONDS
        : 3600,
    reconcileMinAgeSeconds:
      typeof env.GL_RECONCILE_MIN_AGE_SECONDS === 'number'
        ? env.GL_RECONCILE_MIN_AGE_SECONDS
        : 60,
  },
  usageRestriction: {
    mode: env.USAGE_RESTRICTION_MODE ?? 'off',
  },
  grpc: {
    port: typeof env.GRPC_PORT === 'number' ? env.GRPC_PORT : 50072,
    // Loopback default: this port is plaintext and authenticated by a bearer
    // service key — it must not be reachable off-host. Override only when callers
    // genuinely live elsewhere, and firewall it if so.
    bindAddress: env.GRPC_BIND_ADDRESS ?? '127.0.0.1',
  },
  ipWhitelist: env.IP_WHITELIST
    ? env.IP_WHITELIST.split(',')
        .map((ip) => ip.trim())
        .filter(Boolean)
    : [],
} as const;

export const isProduction = config.isProduction;
