import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { WalletTransaction } from '../domain/walletTransaction';
import { WalletTransactionMap } from '../mappers/walletTransactionMap';
import {
  IWalletTransactionRepo,
  WalletBalanceSums,
  SingleMove,
  TransferMove,
} from './interface/IWalletTransactionRepo';

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

  private async setWalletBalance(
    walletId: string,
    newBalance: number,
    requestedBy: string,
    txn: Transaction,
  ): Promise<void> {
    const now = DateTimeObject.create(-1).getValue().value;
    const [affected] = await this.models.Wallet.update(
      { balance: newBalance, updatedAt: now, updatedBy: requestedBy },
      { where: { id: walletId, voided: false }, transaction: txn },
    );
    if (!affected) {
      throw new Error(`Wallet ${walletId} not found while moving balance`);
    }
  }

  public async recordSingle(move: SingleMove): Promise<string> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      await this.setWalletBalance(
        move.walletId,
        move.newBalance,
        move.requestedBy,
        txn,
      );
      const persistent = await WalletTransactionMap.toPersistence(move.tx);
      const saved = await this.baseModel.create(persistent, {
        transaction: txn,
      });
      await txn.commit();
      return saved.id;
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }

  public async recordTransfer(
    move: TransferMove,
  ): Promise<{ debitId: string; creditId: string }> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      await this.setWalletBalance(
        move.source.walletId,
        move.source.newBalance,
        move.requestedBy,
        txn,
      );
      await this.setWalletBalance(
        move.dest.walletId,
        move.dest.newBalance,
        move.requestedBy,
        txn,
      );
      const debitPersistent = await WalletTransactionMap.toPersistence(
        move.debitTx,
      );
      const creditPersistent = await WalletTransactionMap.toPersistence(
        move.creditTx,
      );
      const debit = await this.baseModel.create(debitPersistent, {
        transaction: txn,
      });
      const credit = await this.baseModel.create(creditPersistent, {
        transaction: txn,
      });
      await txn.commit();
      return { debitId: debit.id, creditId: credit.id };
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }
}
