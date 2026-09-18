/**
 * A unit as callers name it: category + unit id. `uomId` is the LEGACY single
 * id (a wlt_uom id, or a retired currency uom id) accepted during the move to
 * unit categories — the UnitRegistry translates it.
 */
export interface UnitInput {
  unitCategoryId?: string;
  unitId?: string;
  /** @deprecated send unitCategoryId + unitId. */
  uomId?: string;
}

export interface CreateWalletDTO extends UnitInput {
  walletTypeId: string;
  ownerTypeId: string;
  ownerId: string;
  /**
   * Caller's idempotency handle. Set only by service-to-service provisioning
   * (ProvisionWallet); the HTTP controller never forwards it, so wallets created
   * through the panel leave it unset. Unique when present.
   */
  externalRef?: string;
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

/** One restriction to apply during provisioning, naming its dimension by key. */
export interface ProvisionRestrictionDTO {
  dimensionKey: string;
  operator: string;
  valueKeys: string[];
}

/**
 * Service-to-service wallet provisioning (create + restrict + fund), idempotent
 * on `externalRef`. Never reachable from the gateway — see
 * {@link ../useCases/wallet/provisionWallet.use-case}.
 */
export interface ProvisionWalletDTO extends UnitInput {
  externalRef: string;
  walletTypeId: string;
  /** CUSTOMER | PARTNER | USER — resolved to an owner-type id by the use case. */
  ownerTypeCode: string;
  ownerId: string;
  displayName?: string;
  /** Unix seconds; undefined ⇒ never expires. */
  expiresAt?: number;
  /** 0 ⇒ no credit. */
  initialCredit: number;
  /** Required whenever `initialCredit` > 0, so a retry funds exactly once. */
  creditIdempotencyKey?: string;
  restrictions: ProvisionRestrictionDTO[];
  requestedBy: string;
}

export interface ProvisionWalletResultDTO {
  walletId: string;
  /** false ⇒ `externalRef` already existed and the original wallet was reused. */
  created: boolean;
  /** false ⇒ no credit was asked for, or it had already been applied. */
  credited: boolean;
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
  unitCategoryId: string;
  unitId: string;
  unitCode: string;
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
