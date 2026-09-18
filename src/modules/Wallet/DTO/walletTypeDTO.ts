import { WalletCategory } from '../domain/walletType';

export interface CreateWalletTypeDTO {
  name: string;
  description?: string;
  category: WalletCategory;
  balanceTypeId: string;
  overdraftAllowed?: boolean;
  overdraftLimit?: number;
  allowTransfersOut?: boolean;
  allowTopup?: boolean;
  allowWithdrawals?: boolean;
  requiredKycLevel?: number;
  glAccountCode?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface UpdateWalletTypeDTO {
  id: string;
  name?: string;
  description?: string;
  category?: WalletCategory;
  balanceTypeId?: string;
  overdraftAllowed?: boolean;
  overdraftLimit?: number;
  allowTransfersOut?: boolean;
  allowTopup?: boolean;
  allowWithdrawals?: boolean;
  requiredKycLevel?: number;
  glAccountCode?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface WalletTypeDTO {
  id: string;
  name: string;
  description?: string;
  category: WalletCategory;
  balanceTypeId: string;
  overdraftAllowed: boolean;
  overdraftLimit?: number;
  allowTransfersOut: boolean;
  allowTopup: boolean;
  allowWithdrawals: boolean;
  requiredKycLevel: number;
  glAccountCode?: string;
  isActive: boolean;
}
