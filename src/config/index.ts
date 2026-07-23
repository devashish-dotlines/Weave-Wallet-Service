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

  // gRPC inbound server (EntityStatus push from the engine).
  GRPC_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .or(z.number())
    .optional(),
  GRPC_BIND_ADDRESS: z.string().min(1).optional(),
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
