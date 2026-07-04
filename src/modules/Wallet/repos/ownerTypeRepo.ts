import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { OwnerType } from '../domain/ownerType';
import { OwnerTypeMap } from '../mappers/ownerTypeMap';
import { IOwnerTypeRepo } from './interface/IOwnerTypeRepo';

export class OwnerTypeRepo extends BaseRepo implements IOwnerTypeRepo {
  constructor(models: any) {
    super(models, models.OwnerType);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<OwnerType | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? OwnerTypeMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<OwnerType | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? OwnerTypeMap.toDomain(instance) : null;
  }

  public async list(): Promise<OwnerType[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: OwnerType[] = [];
    for (const instance of instances) {
      const d = OwnerTypeMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async countWalletsByOwnerType(ownerTypeId: string): Promise<number> {
    return this.models.Wallet.count({
      where: { ownerTypeId, voided: false },
    });
  }

  public async create(domainObject: OwnerType): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await OwnerTypeMap.toPersistence(domainObject);
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

  public async update(domainObject: OwnerType): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No OwnerType exists with this id');
    const persistentObj = await OwnerTypeMap.toPersistence(domainObject);
    const saved = await existing.update(persistentObj);
    return saved.id;
  }
}
