import { Op } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { UomRate } from '../domain/uomRate';
import { UomRateMap } from '../mappers/uomRateMap';
import { IUomRateRepo } from './interface/IUomRateRepo';

export class UomRateRepo extends BaseRepo implements IUomRateRepo {
  constructor(models: any) {
    super(models, models.UomRate);
  }

  /**
   * The rate whose window covers a moment. A rate that starts later is ignored
   * until it does (so one can be scheduled ahead), and one that has already
   * ended is ignored too.
   */
  public async findEffective(
    uomId: string,
    atSeconds: number,
  ): Promise<UomRate | null> {
    const q: any = this.createBaseQuery();
    q.where['uomId'] = uomId;
    q.where['voided'] = false;
    q.where['effectiveFrom'] = { [Op.lte]: atSeconds };
    q.where[Op.or as any] = [
      { effectiveTo: null },
      { effectiveTo: { [Op.gte]: atSeconds } },
    ];
    q.order = [['effectiveFrom', 'DESC'], ['createdAt', 'DESC']];
    const instance = await this.baseModel.findOne(q);
    return instance ? UomRateMap.toDomain(instance) : null;
  }

  /**
   * Live rates whose window intersects [from, to]. Two windows overlap when
   * each starts at or before the other ends — with NULL read as "no end".
   */
  public async findOverlapping(
    uomId: string,
    fromSeconds: number,
    toSeconds: number | null,
    excludeId?: string,
  ): Promise<UomRate[]> {
    const q: any = this.createBaseQuery();
    q.where['uomId'] = uomId;
    q.where['voided'] = false;
    if (excludeId) q.where['id'] = { [Op.ne]: excludeId };
    // existing.from <= to (or the new window never ends)
    const startsBeforeNewEnds =
      toSeconds === null ? {} : { effectiveFrom: { [Op.lte]: toSeconds } };
    q.where[Op.and as any] = [
      startsBeforeNewEnds,
      // existing.to >= from, or the existing window never ends
      {
        [Op.or]: [
          { effectiveTo: null },
          { effectiveTo: { [Op.gte]: fromSeconds } },
        ],
      },
    ];
    q.order = [['effectiveFrom', 'ASC']];
    const rows = await this.baseModel.findAll(q);
    return rows
      .map((r: any) => UomRateMap.toDomain(r))
      .filter((r: UomRate | null): r is UomRate => !!r);
  }

  public async updateEffectiveTo(domainObject: UomRate): Promise<string | null> {
    const q: any = this.createBaseQuery();
    q.where['id'] = domainObject.id.toString();
    const instance = await this.baseModel.findOne(q);
    if (!instance) return null;
    const persistentObj = await UomRateMap.toPersistence(domainObject);
    const saved = await instance.update({
      effectiveTo: persistentObj.effectiveTo,
      updatedBy: persistentObj.updatedBy,
      updatedAt: persistentObj.updatedAt,
      serverVersion: persistentObj.serverVersion,
    });
    return saved.id;
  }

  public async list(uomId?: string): Promise<UomRate[]> {
    const q: any = this.createBaseQuery();
    if (uomId) q.where['uomId'] = uomId;
    q.where['voided'] = false;
    q.order = [['effectiveFrom', 'DESC']];
    const rows = await this.baseModel.findAll(q);
    return rows
      .map((r: any) => UomRateMap.toDomain(r))
      .filter((r: UomRate | null): r is UomRate => !!r);
  }

  public async create(domainObject: UomRate): Promise<string | null> {
    const persistentObj = await UomRateMap.toPersistence(domainObject);
    const saved = await this.baseModel.create(persistentObj);
    return saved.id;
  }
}
