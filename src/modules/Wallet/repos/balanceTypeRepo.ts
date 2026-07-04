import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { BalanceType } from '../domain/balanceType';
import { BalanceTypeMap } from '../mappers/balanceTypeMap';
import { IBalanceTypeRepo } from './interface/IBalanceTypeRepo';

export class BalanceTypeRepo extends BaseRepo implements IBalanceTypeRepo {
  constructor(models: any) {
    super(models, models.BalanceType);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<BalanceType | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? BalanceTypeMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<BalanceType | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? BalanceTypeMap.toDomain(instance) : null;
  }

  public async list(): Promise<BalanceType[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: BalanceType[] = [];
    for (const instance of instances) {
      const d = BalanceTypeMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async create(domainObject: BalanceType): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await BalanceTypeMap.toPersistence(domainObject);
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

  public async update(domainObject: BalanceType): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No BalanceType exists with this id');
    const persistentObj = await BalanceTypeMap.toPersistence(domainObject);
    const saved = await existing.update(persistentObj);
    return saved.id;
  }
}
