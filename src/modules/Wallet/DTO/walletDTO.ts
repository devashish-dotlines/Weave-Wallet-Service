export interface CreateWalletDTO {
  walletTypeId: string;
  uomId: string;
  ownerTypeId: string;
  ownerId: string;
  parentWalletId?: string;
  displayName?: string;
  minBalance?: number;
  maxBalance?: number;
  dailyDebitLimit?: number;
  monthlyDebitLimit?: number;
  /** Unix seconds; optional wallet expiry (FR-WL-4). */
  expiresAt?: number;
  requestedBy: string;
  /** Actor's role ids, forwarded to the engine on workflow initiate. */
  roleIds?: string[];
}

export interface UpdateWalletDTO {
  id: string;
  displayName?: string;
  parentWalletId?: string;
  minBalance?: number;
  maxBalance?: number;
  dailyDebitLimit?: number;
  monthlyDebitLimit?: number;
  expiresAt?: number;
  requestedBy: string;
}

export interface WalletDTO {
  id: string;
  code: string;
  walletTypeId: string;
  uomId: string;
  ownerTypeId: string;
  ownerId: string;
  parentWalletId?: string;
  displayName?: string;
  balance: number;
  heldAmount: number;
  minBalance?: number;
  maxBalance?: number;
  dailyDebitLimit?: number;
  monthlyDebitLimit?: number;
  expiresAt?: number;
  status: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
}
