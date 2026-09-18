import { UomCategory } from '../../domain/uomCategory';

export interface IUomCategoryRepo {
  findById(id: string): Promise<UomCategory | null>;
  findByCode(code: string): Promise<UomCategory | null>;
  list(): Promise<UomCategory[]>;
  create(domainObject: UomCategory): Promise<string | null>;
  update(domainObject: UomCategory): Promise<string | null>;
}
