import { BaseRepo } from '../../../core/infra/BaseRepo';
import { UsageDimension } from '../domain/usageDimension';
import { UsageDimensionMap } from '../mappers/usageDimensionMap';
import { IUsageDimensionRepo } from './interface/IUsageDimensionRepo';

export class UsageDimensionRepo extends BaseRepo implements IUsageDimensionRepo {
  constructor(models: any) {
    super(models, models.UsageDimension);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<UsageDimension | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UsageDimensionMap.toDomain(instance) : null;
  }

  public async findByKey(key: string): Promise<UsageDimension | null> {
    const q = this.createBaseQuery();
    q.where['key'] = key.trim().toLowerCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UsageDimensionMap.toDomain(instance) : null;
  }

  public async list(): Promise<UsageDimension[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: UsageDimension[] = [];
    for (const instance of instances) {
      const d = UsageDimensionMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async countRestrictionsByDimension(
    usageDimensionId: string,
  ): Promise<number> {
    return this.models.WalletUsageRestriction.count({
      where: { usageDimensionId, voided: false },
    });
  }

  public async create(domainObject: UsageDimension): Promise<string | null> {
    try {
      const persistentObj = await UsageDimensionMap.toPersistence(domainObject);
      const saved = await this.baseModel.create(persistentObj);
      return saved.id;
    } catch (err) {
      throw new Error(err as any);
    }
  }

  public async update(domainObject: UsageDimension): Promise<string | null> {
    try {
      const existing = await this.baseModel.findOne({
        where: { id: domainObject.id.toString() },
      });
      if (!existing) throw new Error('No UsageDimension exists with this id');
      const persistentObj = await UsageDimensionMap.toPersistence(domainObject);
      const saved = await existing.update(persistentObj);
      return saved.id;
    } catch (err) {
      throw new Error(err as any);
    }
  }
}
