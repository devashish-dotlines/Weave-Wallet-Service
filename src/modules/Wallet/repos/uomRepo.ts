import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { Uom } from '../domain/uom';
import { UomMap } from '../mappers/uomMap';
import { IUomRepo } from './interface/IUomRepo';

export class UomRepo extends BaseRepo implements IUomRepo {
  constructor(models: any) {
    super(models, models.Uom);
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<Uom | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UomMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<Uom | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UomMap.toDomain(instance) : null;
  }

  public async list(): Promise<Uom[]> {
    const q = this.createBaseQuery();
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: Uom[] = [];
    for (const instance of instances) {
      const d = UomMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  public async create(domainObject: Uom): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await UomMap.toPersistence(domainObject);
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

  public async update(domainObject: Uom): Promise<string | null> {
    const existing = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!existing) throw new Error('No Uom exists with this id');
    const persistentObj = await UomMap.toPersistence(domainObject);
    const saved = await existing.update(persistentObj);
    return saved.id;
  }

  public async findLegacyMapping(
    legacyUomId: string,
  ): Promise<{ unitCategoryId: string; unitId: string; unitCode: string } | null> {
    const row = await this.models.UomLegacyMap.findOne({ where: { legacyUomId } });
    return row
      ? { unitCategoryId: row.unitCategoryId, unitId: row.unitId, unitCode: row.unitCode }
      : null;
  }

  public async countUsage(uomId: string): Promise<{ wallets: number; rates: number }> {
    const [wallets, rates] = await Promise.all([
      this.models.Wallet.count({ where: { unitId: uomId, voided: false } }),
      this.models.UomRate.count({ where: { uomId, voided: false } }),
    ]);
    return { wallets, rates };
  }
}
