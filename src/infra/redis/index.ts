import { createClient } from 'redis';
import { config } from '../../config/index';

// Standalone Redis client. Kept OUT of infra/http/app.ts on purpose: auth.ts
// needs the client, and if it imported it from app.ts the import graph would
// cycle (app → routes → auth → app) AND pull the whole Express server into
// non-HTTP entrypoints like the reconciliation worker. This module imports
// nothing but config, so it is safe to import from anywhere.
const redisClient = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

let initialized = false;

/** Connect lazily; safe to call more than once. No-op when Redis is disabled. */
export async function initRedis(): Promise<void> {
  if (!config.redis.enabled) {
    console.log('Redis is disabled.');
    return;
  }
  if (initialized) return;
  initialized = true;
  try {
    redisClient.on('error', (err) => {
      console.log('Redis Client Error', err);
    });
    redisClient.on('ready', () => console.log('Redis is ready'));
    await redisClient.connect();
    await redisClient.ping();
  } catch (err) {
    console.error('Failed to initialize Redis, continuing without cache:', err);
  }
}

export { redisClient };
