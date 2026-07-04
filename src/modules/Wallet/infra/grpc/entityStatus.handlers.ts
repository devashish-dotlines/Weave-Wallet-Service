import { sendUnaryData, status as GrpcStatus } from '@grpc/grpc-js';
import { AuthedCall } from '../../../../infra/grpc/authInterceptor';
import { workflowEntities } from '../../../../infra/workflow';

/**
 * gRPC adapter for the engine's status push. The engine calls this after it
 * commits a transition; we project the new current status onto the owning
 * entity's row via the SAME `syncStatus` hook the central /v1/workflow router
 * uses (so the engine-direct path and the through-accounting path converge on
 * one projection). proto-loader is configured with keepCase, so request fields
 * are snake_case.
 *
 * Best-effort, mirroring the local projection: an unknown/unmanaged entity type
 * or a projection failure returns `{ ok: false }` rather than erroring — the
 * engine already committed and only logs the outcome.
 */
export async function syncEntityStatus(
  call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  try {
    const r = call.request ?? {};
    const entityType = String(r.entity_type ?? '');
    const entityId = String(r.entity_id ?? '');
    const statusId = String(r.status_id ?? '');

    if (!entityType || !entityId || !statusId) {
      console.log(
        `[grpc] syncEntityStatus: ignoring incomplete request ` +
          `(entityType='${entityType}', entityId='${entityId}', statusId='${statusId}')`,
      );
      return callback(null, { ok: false });
    }
    if (!workflowEntities.has(entityType)) {
      console.log(
        `[grpc] syncEntityStatus: entity type '${entityType}' is not ` +
          `registered with this service — skipping.`,
      );
      return callback(null, { ok: false });
    }
    const config = workflowEntities.resolve(entityType);
    if (!config.syncStatus) {
      console.log(
        `[grpc] syncEntityStatus: entity type '${entityType}' has no ` +
          `syncStatus projection — skipping.`,
      );
      return callback(null, { ok: false });
    }

    await config.syncStatus(entityId, {
      statusId,
      name: r.status_name ? String(r.status_name) : undefined,
      color: r.status_color ? String(r.status_color) : null,
      active: Boolean(r.status_active),
      closed: Boolean(r.closed),
    });
    console.log(
      `[grpc] syncEntityStatus: projected ${entityType} '${entityId}' → ` +
        `status '${r.status_name ?? statusId}'.`,
    );
    return callback(null, { ok: true });
  } catch (err) {
    console.log('[grpc] syncEntityStatus failed:', err);
    return callback({
      code: GrpcStatus.INTERNAL,
      message: 'Failed to project entity status',
    });
  }
}
