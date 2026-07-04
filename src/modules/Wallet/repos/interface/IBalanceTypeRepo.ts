import { BalanceType } from '../../domain/balanceType';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IBalanceTypeRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<BalanceType | null>;
  findByCode(code: string): Promise<BalanceType | null>;
  list(): Promise<BalanceType[]>;
  create(domainObject: BalanceType): Promise<string | null>;
  update(domainObject: BalanceType): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
