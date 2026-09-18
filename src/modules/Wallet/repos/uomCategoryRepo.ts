import { BaseRepo } from '../../../core/infra/BaseRepo';
import { UomCategory } from '../domain/uomCategory';
import { UomCategoryMap } from '../mappers/uomCategoryMap';
import { IUomCategoryRepo } from './interface/IUomCategoryRepo';

export class UomCategoryRepo extends BaseRepo implements IUomCategoryRepo {
  constructor(models: any) {
    super(models, models.UomCategory);
  }

  public async findById(id: string): Promise<UomCategory | null> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UomCategoryMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<UomCategory | null> {
    const q = this.createBaseQuery();
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? UomCategoryMap.toDomain(instance) : null;
  }

  public async list(): Promise<UomCategory[]> {
    const q: any = this.createBaseQuery();
    q.where['voided'] = false;
    q.order = [['code', 'ASC']];
    const rows = await this.baseModel.findAll(q);
    return rows
      .map((r: any) => UomCategoryMap.toDomain(r))
      .filter((c: UomCategory | null): c is UomCategory => !!c);
  }

  public async create(domainObject: UomCategory): Promise<string | null> {
    const saved = await this.baseModel.create(
      await UomCategoryMap.toPersistence(domainObject),
    );
    return saved.id;
  }

  public async update(domainObject: UomCategory): Promise<string | null> {
    const instance = await this.baseModel.findOne({
      where: { id: domainObject.id.toString() },
    });
    if (!instance) return null;
    const saved = await instance.update(
      await UomCategoryMap.toPersistence(domainObject),
    );
    return saved.id;
  }
}
