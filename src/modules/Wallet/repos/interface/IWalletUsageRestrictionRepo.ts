import { Transaction } from 'sequelize';
import { WalletUsageRestriction } from '../../domain/walletUsageRestriction';
import { UsageRestrictionRule } from '../../domain/usageContext';

export interface IWalletUsageRestrictionRepo {
  listByWallet(walletId: string): Promise<WalletUsageRestriction[]>;
  /**
   * Replace a wallet's WHOLE restriction set. Pass an empty array to make the
   * wallet unrestricted. Optionally joins the caller's transaction.
   */
  replaceForWallet(
    walletId: string,
    restrictions: WalletUsageRestriction[],
    requestedBy: string,
    txn?: Transaction,
  ): Promise<void>;
  /**
   * How many live restrictions this wallet has. The spend path calls this first
   * so an unrestricted wallet costs one COUNT and no aggregate load — the same
   * shortcut `isUomAllowed` takes.
   */
  countByWallet(walletId: string): Promise<number>;
  /**
   * The wallet's rules flattened for evaluation, with each dimension resolved to
   * its CODE — rows store ids, but a usage context speaks in codes.
   */
  listRulesForEvaluation(walletId: string): Promise<UsageRestrictionRule[]>;
}
