import { sendUnaryData } from '@grpc/grpc-js';
import { AuthedCall } from '../../../../infra/grpc/authInterceptor';
import { toGrpcError } from '../../../../infra/grpc/grpcStatusMap';
import { localEntityProvider, SELF_SERVICE_KEY } from './localEntitySource';

/**
 * Server side of the generic `EntityQueryService`: exposes THIS service's own
 * entities (under service key `wallet`) to other services so they can tag their
 * single_select/multi_select variables against them. Backed by the shared
 * in-process `localEntityProvider`.
 *
 * Requests naming a `service` other than this one's key resolve to `found=false`
 * (we only own our own entities). Reads snake_case fields (proto-loader keepCase).
 * Guarded by the shared API-key interceptor (service-to-service).
 */

export async function listEntitySources(
  _call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  try {
    const sources = await localEntityProvider.listEntitySources();
    return callback(null, {
      sources: sources.map((s) => ({
        service: s.service,
        entity: s.entity,
        display_name: s.displayName,
        key_field: s.keyField,
        value_field: s.valueField,
      })),
    });
  } catch (err) {
    const { code, message } = toGrpcError(err);
    return callback({ code, message });
  }
}

export async function listEntityValues(
  call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  try {
    const r = call.request ?? {};
    const service = String(r.service ?? '');
    const entity = String(r.entity ?? '');
    if (service && service !== SELF_SERVICE_KEY) {
      return callback(null, { found: false, values: [] });
    }
    const rows = await localEntityProvider.listEntityValues(entity);
    if (rows === null) {
      return callback(null, { found: false, values: [] });
    }
    return callback(null, {
      found: true,
      values: rows.map((v) => ({ key: v.key, value: v.value })),
    });
  } catch (err) {
    const { code, message } = toGrpcError(err);
    return callback({ code, message });
  }
}

export async function entityValuesExist(
  call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  try {
    const r = call.request ?? {};
    const service = String(r.service ?? '');
    const entity = String(r.entity ?? '');
    const keys = Array.isArray(r.keys) ? r.keys.map((k: any) => String(k)) : [];
    if (service && service !== SELF_SERVICE_KEY) {
      return callback(null, { found: false, missing_keys: keys });
    }
    const allowed = await localEntityProvider.resolveAllowedKeys(entity);
    if (allowed === null) {
      return callback(null, { found: false, missing_keys: keys });
    }
    const missing = keys.filter((k: string) => !allowed.has(k));
    return callback(null, { found: true, missing_keys: missing });
  } catch (err) {
    const { code, message } = toGrpcError(err);
    return callback({ code, message });
  }
}
