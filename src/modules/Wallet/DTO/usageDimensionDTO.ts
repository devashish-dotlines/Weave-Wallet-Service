import { UsageDataType, UsageDimensionOption } from '../domain/usageDimension';

export interface CreateUsageDimensionDTO {
  name: string;
  /** Lowercased on save. Spend-time usage contexts are keyed by this. */
  key: string;
  description?: string;
  dataType: UsageDataType;
  /** Numeric types only; ignored otherwise. */
  minValue?: number | null;
  maxValue?: number | null;
  /** String type only — comma-separated allowed set. Omit ⇒ open. */
  allowedValues?: string | null;
  /** Select types only — the inline value list. */
  options?: UsageDimensionOption[];
  isActive?: boolean;
  requestedBy: string;
}

export interface UpdateUsageDimensionDTO {
  id: string;
  name?: string;
  description?: string;
  dataType?: UsageDataType;
  minValue?: number | null;
  maxValue?: number | null;
  allowedValues?: string | null;
  /** Replaces the whole option list when present; omit to leave untouched. */
  options?: UsageDimensionOption[];
  isActive?: boolean;
  requestedBy: string;
  // NOTE: `key` is deliberately absent. Wallet restrictions are matched against
  // incoming usage contexts BY KEY, so renaming one would silently detach every
  // rule that depends on it.
}

export interface UsageDimensionDTO {
  id: string;
  name: string;
  key: string;
  description?: string;
  dataType: UsageDataType;
  minValue?: number | null;
  maxValue?: number | null;
  allowedValues?: string | null;
  options: UsageDimensionOption[];
  isActive: boolean;
}
