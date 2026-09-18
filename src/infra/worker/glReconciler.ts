import { config } from '../../config';
import { DateTimeObject } from '../../modules/Core/domain/dateTimeObject';
import { walletTransactionRepo } from '../../modules/Wallet/repos';
import { glPosting } from '../../modules/Wallet/services';
import { sweepUnpostedGl } from '../../modules/Wallet/services/glReconciler';

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Starts the periodic GL sweep in this process. No-op unless GL posting is
 * enabled and accounting is configured. Safe to run on several instances.
 */
export function startGlReconciler(): void {
  if (timer || !glPosting.isEnabled) return;
  const intervalMs = Math.max(config.accounting.reconcileIntervalSeconds, 10) * 1000;

  const tick = async () => {
    if (running) return; // a slow sweep never overlaps itself
    running = true;
    try {
      const r = await sweepUnpostedGl(glPosting, walletTransactionRepo, {
        nowSeconds: DateTimeObject.create(-1).getValue().value,
        minAgeSeconds: config.accounting.reconcileMinAgeSeconds,
        retryAfterSeconds: config.accounting.reconcileRetryAfterSeconds,
        batchSize: config.accounting.reconcileBatchSize,
      });
      if (r.scanned) {
        console.log(
          `[gl-reconciler] scanned ${r.scanned}, posted ${r.posted}, failed ${r.failed}`,
        );
      }
    } catch (err) {
      console.error('[gl-reconciler] sweep failed:', err);
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  timer.unref();
  console.log(`[gl-reconciler] started (every ${intervalMs / 1000}s)`);
}
