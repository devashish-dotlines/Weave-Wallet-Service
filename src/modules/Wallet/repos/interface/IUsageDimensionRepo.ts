import { UsageDimension } from '../../domain/usageDimension';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IUsageDimensionRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<UsageDimension | null>;
  findByKey(key: string): Promise<UsageDimension | null>;
  list(): Promise<UsageDimension[]>;
  /** Count wallet restrictions referencing this dimension (one in use is protected). */
  countRestrictionsByDimension(usageDimensionId: string): Promise<number>;
  create(domainObject: UsageDimension): Promise<string | null>;
  update(domainObject: UsageDimension): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
