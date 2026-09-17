import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { Wallet } from '../domain/wallet';
import { WalletMap } from '../mappers/walletMap';
import { IWalletRepo, WalletStatusProjection } from './interface/IWalletRepo';

export class WalletRepo extends BaseRepo implements IWalletRepo {
  constructor(models: any) {
    super(models, models.Wallet);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<Wallet | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<Wallet | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletMap.toDomain(instance) : null;
  }

  public async findByExternalRef(externalRef: string): Promise<Wallet | null> {
    const q = this.createBaseQuery();
    q.where['externalRef'] = externalRef;
    // No `voided` filter — see IWalletRepo. The unique index covers voided rows
    // too, so treating one as absent would just fail the insert on retry.
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletMap.toDomain(instance) : null;
  }

  public async list(): Promise<Wallet[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: Wallet[] = [];
    for (const instance of instances) {
      const d = WalletMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async create(domainObject: Wallet): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await WalletMap.toPersistence(domainObject);
      const saved = await this.baseModel.create(persistentObj, {
        transaction: txn,
      });
      await txn.commit();
      return saved.id;
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }

  public async update(domainObject: Wallet): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No Wallet exists with this id');
    const persistentObj = await WalletMap.toPersistence(domainObject);
    const saved = await existing.update(persistentObj);
    return saved.id;
  }

  public async setBalance(
    id: string,
    balance: number,
    requestedBy: string,
  ): Promise<void> {
    const existing = await this.baseModel.findOne({ where: { id } });
    if (!existing) return;
    await existing.update({
      balance,
      updatedBy: requestedBy,
      updatedAt: DateTimeObject.create(-1).getValue().value,
    });
  }

  public async setWorkflowStatus(
    id: string,
    s: WalletStatusProjection,
  ): Promise<void> {
    const existing = await this.baseModel.findOne({ where: { id } });
    if (!existing) return;
    await existing.update({
      status: s.name ?? s.statusId,
      statusId: s.statusId,
      statusName: s.name ?? null,
      statusColor: s.color ?? null,
      updatedAt: DateTimeObject.create(-1).getValue().value,
    });
  }
}
