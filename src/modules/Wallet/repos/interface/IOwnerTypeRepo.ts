import { OwnerType } from '../../domain/ownerType';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IOwnerTypeRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<OwnerType | null>;
  findByCode(code: string): Promise<OwnerType | null>;
  list(): Promise<OwnerType[]>;
  /** Count wallets referencing this owner type (protects it from deletion). */
  countWalletsByOwnerType(ownerTypeId: string): Promise<number>;
  create(domainObject: OwnerType): Promise<string | null>;
  update(domainObject: OwnerType): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
