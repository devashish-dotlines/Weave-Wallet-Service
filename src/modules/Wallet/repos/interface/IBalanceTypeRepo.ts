import { BalanceType } from '../../domain/balanceType';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IBalanceTypeRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<BalanceType | null>;
  findByCode(code: string): Promise<BalanceType | null>;
  list(): Promise<BalanceType[]>;
  /**
   * Whether this balance type may be denominated in the given UOM. An untagged
   * balance type is unrestricted, so every UOM passes.
   */
  isUomAllowed(balanceTypeId: string, uomId: string): Promise<boolean>;
  /** Count wallet types referencing this balance type (a type in use is protected). */
  countWalletTypesByBalanceType(balanceTypeId: string): Promise<number>;
  create(domainObject: BalanceType): Promise<string | null>;
  update(domainObject: BalanceType): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
