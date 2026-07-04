import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { WalletType } from '../domain/walletType';
import { WalletTypeMap } from '../mappers/walletTypeMap';
import { IWalletTypeRepo } from './interface/IWalletTypeRepo';

export class WalletTypeRepo extends BaseRepo implements IWalletTypeRepo {
  constructor(models: any) {
    super(models, models.WalletType);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<WalletType | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletTypeMap.toDomain(instance) : null;
  }

  public async findByName(name: string): Promise<WalletType | null> {
    const q = this.createBaseQuery();
    q.where['name'] = name.trim();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? WalletTypeMap.toDomain(instance) : null;
  }

  public async list(): Promise<WalletType[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: WalletType[] = [];
    for (const instance of instances) {
      const d = WalletTypeMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async countWalletsByType(walletTypeId: string): Promise<number> {
    return this.models.Wallet.count({
      where: { walletTypeId, voided: false },
    });
  }

  public async create(domainObject: WalletType): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await WalletTypeMap.toPersistence(domainObject);
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

  public async update(domainObject: WalletType): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No WalletType exists with this id');
    const persistentObj = await WalletTypeMap.toPersistence(domainObject);
    const saved = await existing.update(persistentObj);
    return saved.id;
  }
}
