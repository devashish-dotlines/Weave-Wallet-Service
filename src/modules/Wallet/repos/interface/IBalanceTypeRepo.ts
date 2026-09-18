import { BalanceType } from '../../domain/balanceType';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IBalanceTypeRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<BalanceType | null>;
  findByCode(code: string): Promise<BalanceType | null>;
  list(): Promise<BalanceType[]>;
  /** Balance types listing this unit (a unit in use is protected from delete). */
  countByUnit(unitId: string): Promise<number>;
  /** Count wallet types referencing this balance type (a type in use is protected). */
  countWalletTypesByBalanceType(balanceTypeId: string): Promise<number>;
  create(domainObject: BalanceType): Promise<string | null>;
  update(domainObject: BalanceType): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
