import { IWalletTransactionRepo } from '../repos/interface/IWalletTransactionRepo';
import { GlPostingService } from './glPosting.service';

export interface GlSweepResult {
  scanned: number;
  posted: number;
  failed: number;
}

/**
 * One reconciler pass: post every movement old enough that its inline post has
 * had its chance but still has no voucher. Failures are logged per row and left
 * for the next pass — accounting's idempotency on `WTX:<code>` makes overlap
 * with inline posts (or another instance's sweep) harmless.
 */
export async function sweepUnpostedGl(
  service: GlPostingService,
  txRepo: IWalletTransactionRepo,
  opts: {
    nowSeconds: number;
    minAgeSeconds: number;
    /** A row that failed waits this long before the sweep retries it. */
    retryAfterSeconds: number;
    batchSize: number;
  },
): Promise<GlSweepResult> {
  const result: GlSweepResult = { scanned: 0, posted: 0, failed: 0 };
  if (!service.isEnabled) return result;

  const rows = await txRepo.listUnpostedForGl({
    createdBefore: opts.nowSeconds - opts.minAgeSeconds,
    lastFailedBefore: opts.nowSeconds - opts.retryAfterSeconds,
    limit: opts.batchSize,
  });
  for (const tx of rows) {
    result.scanned++;
    try {
      if ((await service.postForTransaction(tx.id.toString())) === 'posted') {
        result.posted++;
      }
    } catch (err) {
      result.failed++;
      try {
        await txRepo.markGlAttemptFailed(tx.id.toString(), opts.nowSeconds);
      } catch (stampErr) {
        console.error(`[gl-reconciler] could not stamp failed attempt on ${tx.code}:`, stampErr);
      }
      console.error(
        `[gl-reconciler] ${tx.code} (${tx.sourceType}) still unposted:`,
        (err as Error)?.message ?? err,
      );
    }
  }
  return result;
}
