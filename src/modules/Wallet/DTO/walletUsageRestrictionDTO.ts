import { UsageOperator } from '../domain/walletUsageRestriction';

export interface SetWalletUsageRestrictionRowDTO {
  usageDimensionId: string;
  operator: UsageOperator;
  /** Dimension-value codes. Must be non-empty — drop the row to lift the rule. */
  valueKeys: string[];
  /** Reserved for OR-of-groups; defaults to 0. */
  groupNo?: number;
}

/**
 * Replaces a wallet's WHOLE restriction set (send `restrictions: []` to make the
 * wallet unrestricted), matching the whole-list-replace semantics the balance
 * type's `allowedUomIds` already uses.
 */
export interface SetWalletUsageRestrictionsDTO {
  walletId: string;
  restrictions: SetWalletUsageRestrictionRowDTO[];
  requestedBy: string;
}

export interface WalletUsageRestrictionDTO {
  id: string;
  usageDimensionId: string;
  /** Joined from the dimension so the panel renders without an N+1. */
  dimensionKey?: string;
  dimensionName?: string;
  operator: UsageOperator;
  valueKeys: string[];
  groupNo: number;
}
