import { walletActions } from './actionRegistry';
import { creditTopupRequestUseCase } from '../../useCases/topupRequest';
import { PermanentTopupCreditFailure } from '../../useCases/topupRequest/topupRequest.use-cases';

/**
 * Composition root for the Wallet module's workflow ENGINE ACTIONS. Each action
 * binds its engine `ActionDefinition.slug` to a handler. The slug is a stable
 * contract with the engine: the ActionDefinition created there must use the
 * SAME slug, with `actionType: 'grpc'`.
 *
 * Slugs MUST be the engine's canonical hyphenated form — the engine normalizes
 * `_` → `-` before dispatching.
 */

/**
 * Fired by the transition action rule on `wallet_topup_request` → `approved`.
 * Its success status should be `credited`, and that follow-up rule must allow
 * ANY role (the engine advances as system).
 */
export const CREDIT_TOPUP_ACTION = 'credit-wallet-topup';

let registered = false;

/** Register the Wallet module's engine actions. Idempotent. */
export function registerWalletActions(): void {
  if (registered) return;

  walletActions.register(
    CREDIT_TOPUP_ACTION,
    async ({ entityId }) => {
      try {
        const result = await creditTopupRequestUseCase.execute(entityId);
        console.log(
          `[topup] ${entityId} ${result.creditedNow ? 'credited' : 'already credited'} ` +
            `(wallet tx ${result.walletTransactionId})`,
        );
      } catch (err) {
        // Permanent: report handled-but-failed so the engine stops retrying and
        // the request parks at `approved` for a human.
        if (err instanceof PermanentTopupCreditFailure) {
          return { ok: false as const, message: err.message };
        }
        throw err; // retryable
      }
    },
    {
      label: 'Credit approved wallet top-up',
      description:
        'Credits the wallet for an approved manual bank-deposit top-up request (idempotent).',
    },
  );

  registered = true;
}
