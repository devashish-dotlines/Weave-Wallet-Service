import { Transaction, literal } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { ServerVersion } from '../../../core/service/serverVersion';
import { Wallet } from '../domain/wallet';
import { WalletTransaction } from '../domain/walletTransaction';
import { WalletMap } from '../mappers/walletMap';
import { WalletTransactionMap } from '../mappers/walletTransactionMap';
import {
  IWalletTransactionRepo,
  WalletBalanceSums,
  MovePlanner,
  MoveOutcome,
  MoveContext,
  ApplyMovesOptions,
  UnpostedGlQuery,
  IdempotencyConflictError,
} from './interface/IWalletTransactionRepo';
import { Op } from 'sequelize';

export class WalletTransactionRepo
  extends BaseRepo
  implements IWalletTransactionRepo
{
  constructor(models: any) {
    super(models, models.WalletTransaction);
  }

  public async findById(id: string): Promise<WalletTransaction | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletTransactionMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<WalletTransaction | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletTransactionMap.toDomain(instance) : null;
  }

  public async findByIdempotencyKey(
    key: string,
  ): Promise<WalletTransaction | null> {
    const q = this.createBaseQuery();
    q.where['idempotencyKey'] = key;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletTransactionMap.toDomain(instance) : null;
  }

  public async listByWallet(walletId: string): Promise<WalletTransaction[]> {
    const instances = await this.baseModel.findAll({
      where: { walletId, voided: false },
      order: [['createdAt', 'DESC']],
    });
    const out: WalletTransaction[] = [];
    for (const instance of instances) {
      const d = WalletTransactionMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async sumForWallet(walletId: string): Promise<WalletBalanceSums> {
    // Sum in JS to stay dialect-agnostic; volumes are per-wallet and modest.
    const rows = await this.baseModel.findAll({
      where: { walletId, voided: false, state: 'completed' },
      attributes: ['direction', 'amount'],
      raw: true,
    });
    let credits = 0;
    let debits = 0;
    for (const r of rows) {
      const amt = Number(r.amount);
      if (r.direction === 'credit') credits += amt;
      else if (r.direction === 'debit') debits += amt;
    }
    return { credits, debits };
  }

  public async findByParentId(
    parentTransactionId: string,
  ): Promise<WalletTransaction[]> {
    const instances = await this.baseModel.findAll({
      where: { parentTransactionId, voided: false },
    });
    const out: WalletTransaction[] = [];
    for (const instance of instances) {
      const d = WalletTransactionMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  /** Locks the wallets in id order so concurrent transfers cannot deadlock. */
  private async lockWallets(
    walletIds: string[],
    txn: Transaction,
  ): Promise<Map<string, Wallet>> {
    const ids = [...new Set(walletIds)].sort();
    const rows = await this.models.Wallet.findAll({
      where: { id: ids, voided: false },
      order: [['id', 'ASC']],
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    });
    const locked = new Map<string, Wallet>();
    for (const row of rows) {
      const wallet = WalletMap.toDomain(row);
      if (wallet) locked.set(wallet.id.toString(), wallet);
    }
    return locked;
  }

  private async setWalletBalance(
    walletId: string,
    newBalance: number,
    requestedBy: string,
    txn: Transaction,
  ): Promise<void> {
    const now = DateTimeObject.create(-1).getValue().value;
    const [affected] = await this.models.Wallet.update(
      {
        balance: newBalance,
        updatedAt: now,
        updatedBy: requestedBy,
        serverVersion: await new ServerVersion().getServerVersion(),
      },
      { where: { id: walletId, voided: false }, transaction: txn },
    );
    if (!affected) {
      throw new Error(`Wallet ${walletId} not found while moving balance`);
    }
  }

  public async applyMoves<E>(
    walletIds: string[],
    requestedBy: string,
    planner: MovePlanner<E>,
    options: ApplyMovesOptions = {},
  ): Promise<MoveOutcome<E>> {
    let txn: Transaction | undefined;
    try {
      txn = (await this.models['sequelize'].transaction()) as Transaction;
      const locked = await this.lockWallets(walletIds, txn);
      const context: MoveContext = {};
      if (options.outgoingSince) {
        context.outgoingTotal = await this.sumOutgoing(options.outgoingSince, txn);
      }
      const plan = planner(locked, context);
      if (!plan.ok) {
        await txn.rollback();
        return plan;
      }

      for (const b of plan.balances) {
        await this.setWalletBalance(b.walletId, b.newBalance, requestedBy, txn);
      }
      const txIds: string[] = [];
      for (const tx of plan.txs) {
        const persistent = await WalletTransactionMap.toPersistence(tx);
        const saved = await this.baseModel.create(persistent, {
          transaction: txn,
        });
        txIds.push(saved.id);
      }
      await txn.commit();
      return { ok: true, txIds };
    } catch (err) {
      if (txn) await txn.rollback();
      if (isIdempotencyKeyViolation(err)) {
        throw new IdempotencyConflictError((err as any)?.fields?.idempotency_key);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  public async setGlVoucher(
    transactionIds: string[],
    glVoucherId: string,
  ): Promise<void> {
    if (transactionIds.length === 0) return;
    await this.baseModel.update(
      {
        glVoucherId,
        updatedAt: DateTimeObject.create(-1).getValue().value,
        serverVersion: await new ServerVersion().getServerVersion(),
      },
      { where: { id: transactionIds } },
    );
  }

  public async markGlAttemptFailed(
    transactionId: string,
    atSeconds: number,
  ): Promise<void> {
    // Not a business change: no updatedAt/serverVersion bump.
    await this.baseModel.update(
      { glLastAttemptAt: atSeconds },
      { where: { id: transactionId } },
    );
  }

  public async listUnpostedForGl(
    query: UnpostedGlQuery,
  ): Promise<WalletTransaction[]> {
    const rows = await this.baseModel.findAll({
      where: {
        voided: false,
        state: 'completed',
        glVoucherId: null,
        createdAt: { [Op.lte]: query.createdBefore },
        [Op.and]: [
          {
            [Op.or]: [
              { sourceType: 'BANK_DEPOSIT', direction: 'credit' },
              { sourceType: 'TRANSFER', direction: 'debit' },
            ],
          },
          {
            [Op.or]: [
              { glLastAttemptAt: null },
              { glLastAttemptAt: { [Op.lte]: query.lastFailedBefore } },
            ],
          },
          // Only wallets whose unit has a money value. Minutes and megabytes
          // never post, and leaving them in would make every sweep re-pick
          // them oldest-first until they crowded real money out of the batch.
          {
            walletId: {
              [Op.in]: literal(
                `(SELECT w.id FROM wlt_wallet w
                    JOIN wlt_uom_category c ON c.id = w.unit_category_id
                   WHERE c.valued = true)`,
              ),
            },
          },
        ],
      },
      order: [['createdAt', 'ASC']],
      limit: query.limit,
    });
    const out: WalletTransaction[] = [];
    for (const row of rows) {
      const d = WalletTransactionMap.toDomain(row);
      if (d) out.push(d);
    }
    return out;
  }

  /** Completed outgoing debits since a moment, in cents-safe money. */
  private async sumOutgoing(
    q: { walletId: string; since: number; sourceType?: string },
    txn: Transaction,
  ): Promise<number> {
    const where: any = {
      walletId: q.walletId,
      direction: 'debit',
      state: 'completed',
      voided: false,
      createdAt: { [Op.gte]: q.since },
    };
    if (q.sourceType) where.sourceType = q.sourceType;
    const rows = await this.baseModel.findAll({
      where,
      attributes: ['amount'],
      raw: true,
      transaction: txn,
    });
    let cents = 0;
    for (const r of rows) cents += Math.round(Number(r.amount) * 100);
    return cents / 100;
  }

  public async recomputeBalance(
    walletId: string,
    requestedBy: string,
  ): Promise<number | null> {
    let txn: Transaction | undefined;
    try {
      txn = (await this.models['sequelize'].transaction()) as Transaction;
      const locked = await this.lockWallets([walletId], txn);
      if (!locked.has(walletId)) {
        await txn.rollback();
        return null;
      }
      const rows = await this.baseModel.findAll({
        where: { walletId, voided: false, state: 'completed' },
        attributes: ['direction', 'amount'],
        raw: true,
        transaction: txn,
      });
      let cents = 0;
      for (const r of rows) {
        const amt = Math.round(Number(r.amount) * 100);
        if (r.direction === 'credit') cents += amt;
        else if (r.direction === 'debit') cents -= amt;
      }
      const balance = cents / 100;
      await this.setWalletBalance(walletId, balance, requestedBy, txn);
      await txn.commit();
      return balance;
    } catch (err) {
      if (txn) await txn.rollback();
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

/**
 * True when a Sequelize unique violation hit the idempotency_key index. MySQL
 * reports the index name in `fields`, Postgres the column; both contain it.
 */
function isIdempotencyKeyViolation(err: unknown): boolean {
  const e = err as any;
  if (e?.name !== 'SequelizeUniqueConstraintError') return false;
  const fieldHit = Object.keys(e.fields ?? {}).some((k) =>
    k.toLowerCase().includes('idempotency'),
  );
  const pathHit = (e.errors ?? []).some((x: any) =>
    String(x?.path ?? '').toLowerCase().includes('idempotency'),
  );
  return fieldHit || pathHit;
}
