import { Wallet } from '../../domain/wallet';
import { WalletTransaction } from '../../domain/walletTransaction';

/** Sum of completed movements on a wallet, used to recompute its balance. */
export interface WalletBalanceSums {
  credits: number;
  debits: number;
}

/**
 * What a planner decided after inspecting the locked wallets: either reject
 * with a use-case error, or the new balances plus the transaction rows to insert.
 */
export type MovePlan<E> =
  | { ok: false; error: E }
  | {
      ok: true;
      balances: { walletId: string; newBalance: number }[];
      txs: WalletTransaction[];
    };

/**
 * Runs while the wallets are row-locked, so balances it reads cannot change
 * until the move commits. Wallets that do not exist (or are voided) are absent
 * from the map. Must be synchronous: nothing slow may happen under the lock.
 */
export type MovePlanner<E> = (
  locked: Map<string, Wallet>,
  context: MoveContext,
) => MovePlan<E>;

/**
 * Asks `applyMoves` to total a wallet's completed outgoing debits since a
 * moment, read AFTER the lock — so concurrent spends from the same wallet
 * serialize and a daily limit can't be raced past.
 */
export interface OutgoingTotalQuery {
  walletId: string;
  /** Unix seconds, inclusive. */
  since: number;
  /** Only count debits with this source (e.g. TRANSFER). */
  sourceType?: string;
}

export interface MoveContext {
  /** Present when `outgoingSince` was requested. */
  outgoingTotal?: number;
}

export interface ApplyMovesOptions {
  outgoingSince?: OutgoingTotalQuery;
}

export type MoveOutcome<E> =
  | { ok: false; error: E }
  | { ok: true; txIds: string[] };

/**
 * Thrown by `applyMoves` when a transaction row's idempotency key already
 * exists — a concurrent request with the same key committed first. The caller
 * replays the prior result instead of failing.
 */
export class IdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string | undefined) {
    super(`Idempotency key already used: ${idempotencyKey ?? '(unknown)'}`);
    this.name = 'IdempotencyConflictError';
  }
}

export interface IWalletTransactionRepo {
  findById(id: string): Promise<WalletTransaction | null>;
  findByCode(code: string): Promise<WalletTransaction | null>;
  findByIdempotencyKey(key: string): Promise<WalletTransaction | null>;
  /** The legs linked to a parent transaction (a transfer's credit leg). */
  findByParentId(parentTransactionId: string): Promise<WalletTransaction[]>;
  listByWallet(walletId: string): Promise<WalletTransaction[]>;
  /** Completed credit/debit totals for a wallet (recompute source). */
  sumForWallet(walletId: string): Promise<WalletBalanceSums>;
  /**
   * Locks `walletIds` (SELECT … FOR UPDATE, in id order), lets `planner` decide
   * against the locked rows, then writes the balances and inserts the rows in
   * the same DB transaction.
   */
  applyMoves<E>(
    walletIds: string[],
    requestedBy: string,
    planner: MovePlanner<E>,
    options?: ApplyMovesOptions,
  ): Promise<MoveOutcome<E>>;
  /**
   * Under the wallet's row lock, sets the balance to Σ completed credits −
   * Σ completed debits. Returns null when the wallet does not exist.
   */
  recomputeBalance(walletId: string, requestedBy: string): Promise<number | null>;
  /** Record the accounting voucher posted for these transaction rows. */
  setGlVoucher(transactionIds: string[], glVoucherId: string): Promise<void>;
  /** Stamp a failed GL posting attempt (starts the row's retry window). */
  markGlAttemptFailed(transactionId: string, atSeconds: number): Promise<void>;
  /**
   * Completed rows still waiting for a voucher, oldest first — the GL
   * reconciler's work list. Only the rows a voucher is keyed by: credit legs of
   * BANK_DEPOSIT, debit legs of TRANSFER.
   */
  listUnpostedForGl(query: UnpostedGlQuery): Promise<WalletTransaction[]>;
}

export interface UnpostedGlQuery {
  /** Only rows created at or before this unix-seconds moment. */
  createdBefore: number;
  /** Skip rows whose last failed attempt is after this unix-seconds moment. */
  lastFailedBefore: number;
  limit: number;
}
