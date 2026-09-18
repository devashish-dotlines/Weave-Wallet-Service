import { sendUnaryData } from '@grpc/grpc-js';
import { AuthedCall } from './authInterceptor';
import { walletActions } from '../../modules/Wallet/infra/workflow/actionRegistry';

/**
 * gRPC adapter for the engine's action discovery
 * (EntityStatusService.ListActions). Returns the actions this service exposes
 * so the admin panel can offer a predefined "process" dropdown. Read-only.
 */
export async function listActions(
  _call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  const actions = walletActions.list().map((a) => ({
    slug: a.slug,
    label: a.label,
    description: a.description,
  }));
  return callback(null, { actions });
}

/**
 * gRPC adapter for the engine's action dispatch
 * (EntityStatusService.DispatchAction). Entity/action-agnostic: resolves
 * `action_slug` against the wallet action registry and runs its handler.
 *
 * Contract:
 *   - success        → { ok: true }   ⇒ engine advances status.
 *   - unknown action → { ok: false }  ⇒ no retry, no advance.
 *   - handled but permanently failed → { ok: false } ⇒ no retry, no advance.
 *   - real failure   → gRPC INTERNAL  ⇒ engine retries, no advance.
 *
 * Delivery is at-least-once, so every registered handler must be idempotent.
 * proto-loader keepCase ⇒ request fields are snake_case.
 */
export async function dispatchAction(
  call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  const r = call.request ?? {};
  const actionSlug = String(r.action_slug ?? '');
  const entityId = String(r.entity_id ?? '');

  const handler = walletActions.get(actionSlug);
  if (!handler) {
    console.warn(`[grpc-action] unknown action slug '${actionSlug}' — skipping`);
    return callback(null, {
      ok: false,
      message: `Unknown action '${actionSlug}'`,
    });
  }

  let payload: Record<string, unknown> = {};
  if (r.payload) {
    try {
      payload = JSON.parse(String(r.payload));
    } catch {
      console.warn(
        `[grpc-action] '${actionSlug}' payload was not valid JSON — ignoring it`,
      );
    }
  }

  try {
    const outcome = await handler({ entityId, payload });
    if (outcome && outcome.ok === false) {
      console.error(
        `[grpc-action] '${actionSlug}' on ${entityId} failed permanently: ${outcome.message}`,
      );
      return callback(null, { ok: false, message: outcome.message });
    }
    return callback(null, { ok: true, message: '' });
  } catch (err) {
    console.error(`[grpc-action] '${actionSlug}' on ${entityId} failed:`, err);
    return callback({
      code: 13, // INTERNAL
      message: `Action '${actionSlug}' failed: ${(err as Error)?.message ?? err}`,
    } as any);
  }
}
