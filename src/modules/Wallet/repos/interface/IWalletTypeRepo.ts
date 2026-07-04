import { WalletType } from '../../domain/walletType';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

export interface IWalletTypeRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<WalletType | null>;
  findByName(name: string): Promise<WalletType | null>;
  list(): Promise<WalletType[]>;
  /** Count wallets referencing this type (FR-WT-4: a type in use is protected). */
  countWalletsByType(walletTypeId: string): Promise<number>;
  create(domainObject: WalletType): Promise<string | null>;
  update(domainObject: WalletType): Promise<string | null>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
