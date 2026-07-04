import { WalletTransaction } from '../../domain/walletTransaction';

/** Sum of completed movements on a wallet, used to recompute its balance. */
export interface WalletBalanceSums {
  credits: number;
  debits: number;
}

/** A single-wallet balance move + its transaction row, applied atomically. */
export interface SingleMove {
  walletId: string;
  newBalance: number;
  requestedBy: string;
  tx: WalletTransaction;
}

/** A transfer: two balance moves + two linked transaction rows, atomic. */
export interface TransferMove {
  source: { walletId: string; newBalance: number };
  dest: { walletId: string; newBalance: number };
  requestedBy: string;
  debitTx: WalletTransaction;
  creditTx: WalletTransaction;
}

export interface IWalletTransactionRepo {
  findById(id: string): Promise<WalletTransaction | null>;
  findByCode(code: string): Promise<WalletTransaction | null>;
  findByIdempotencyKey(key: string): Promise<WalletTransaction | null>;
  listByWallet(walletId: string): Promise<WalletTransaction[]>;
  /** Completed credit/debit totals for a wallet (recompute source). */
  sumForWallet(walletId: string): Promise<WalletBalanceSums>;
  /** Atomically update one wallet's balance and insert its transaction row. */
  recordSingle(move: SingleMove): Promise<string>;
  /** Atomically move balance between two wallets and insert both legs. */
  recordTransfer(move: TransferMove): Promise<{ debitId: string; creditId: string }>;
}
