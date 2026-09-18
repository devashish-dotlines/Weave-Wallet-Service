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
  /** Where a retired currency uom id went (wlt_uom_legacy_map), if anywhere. */
  findLegacyMapping(
    legacyUomId: string,
  ): Promise<{ unitCategoryId: string; unitId: string; unitCode: string } | null>;
  /** Wallets and live rates that still reference this unit (delete guard). */
  countUsage(uomId: string): Promise<{ wallets: number; rates: number }>;
}
