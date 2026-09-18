import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../../config/index';

// Resolve the proto from the project root (cwd under `npm start`/nodemon).
// Kept byte-identical to the configuration-service's proto/configQuery.proto.
const PROTO_PATH = path.resolve(process.cwd(), 'proto/configQuery.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto: any = grpc.loadPackageDefinition(packageDefinition);
const ConfigurationQueryServiceClient =
  proto.configuration.v1.ConfigurationQueryService;

export interface ConfigValue {
  key: string;
  value: string;
  valueType: string;
  scope: string;
}

interface CacheEntry {
  values: ConfigValue[] | null;
  expiresAt: number;
}

/**
 * Client onto the configuration-service `ConfigurationQueryService.Lookup`.
 * Results are cached briefly per (type, key, scope). On outage it serves the
 * last cached answer, else THROWS — callers that gate money movement on this
 * config must fail rather than proceed unconfigured. Authenticated with this
 * service's API key (`x-api-key`), never the gateway JWT.
 */
export class ConfigClient {
  private readonly client: any;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    target: string,
    private readonly apiKey: string,
    private readonly deadlineMs: number,
    private readonly cacheTtlMs: number,
  ) {
    this.client = new ConfigurationQueryServiceClient(
      target,
      grpc.credentials.createInsecure(),
    );
  }

  private metadata(): grpc.Metadata {
    const md = new grpc.Metadata();
    md.set('x-api-key', this.apiKey);
    return md;
  }

  /** Active values for a type (+ optional key/scope); null when the type is unknown. */
  async lookup(
    typeCode: string,
    key = '',
    scope = '',
  ): Promise<ConfigValue[] | null> {
    const cacheKey = `${typeCode}|${key}|${scope}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.values;
    try {
      const values = await this.invokeLookup(typeCode, key, scope);
      this.cache.set(cacheKey, { values, expiresAt: now + this.cacheTtlMs });
      return values;
    } catch (err) {
      console.error('[config] Lookup failed:', (err as Error).message);
      if (cached) return cached.values;
      throw err;
    }
  }

  private invokeLookup(
    typeCode: string,
    key: string,
    scope: string,
  ): Promise<ConfigValue[] | null> {
    return new Promise((resolve, reject) => {
      this.client.Lookup(
        { type_code: typeCode, key, scope, active_only: true },
        this.metadata(),
        { deadline: Date.now() + this.deadlineMs },
        (err: grpc.ServiceError | null, res: any) => {
          if (err) return reject(err);
          if (!res?.found) return resolve(null);
          const values = Array.isArray(res.values) ? res.values : [];
          resolve(
            values.map((v: any) => ({
              key: String(v.key ?? ''),
              value: String(v.value ?? ''),
              valueType: String(v.value_type ?? ''),
              scope: String(v.scope ?? ''),
            })),
          );
        },
      );
    });
  }
}

/** Configured singleton, or null when CONFIG_GRPC_TARGET is unset. */
export const configClient: ConfigClient | null = config.configuration.grpcTarget
  ? new ConfigClient(
      config.configuration.grpcTarget,
      config.configuration.apiKey,
      config.configuration.deadlineMs,
      config.configuration.cacheTtlMs,
    )
  : null;
