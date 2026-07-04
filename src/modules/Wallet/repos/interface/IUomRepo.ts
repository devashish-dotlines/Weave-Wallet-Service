import { Uom } from '../../domain/uom';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IUomRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<Uom | null>;
  findByCode(code: string): Promise<Uom | null>;
  list(): Promise<Uom[]>;
  create(domainObject: Uom): Promise<string | null>;
  update(domainObject: Uom): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
