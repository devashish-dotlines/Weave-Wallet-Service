export interface UomRateDTO {
  id: string;
  uomId: string;
  /** Convenience for admin screens; absent on nested reads. */
  uomCode?: string;
  /** Base-currency amount one unit of the UOM is worth. */
  baseValue: number;
  effectiveFrom: number;
  /** Inclusive end; absent means open-ended. */
  effectiveTo?: number;
  note?: string;
  createdAt: number;
  createdBy: string;
}

export interface CreateUomRateDTO {
  uomId: string;
  baseValue: number;
  /** Unix seconds; defaults to now. */
  effectiveFrom?: number;
  /** Unix seconds, inclusive; omit for open-ended. */
  effectiveTo?: number;
  note?: string;
  /**
   * Close the currently open-ended rate the moment this one starts, instead of
   * refusing the overlap. Defaults to true.
   */
  closeCurrent?: boolean;
  requestedBy: string;
}

export interface ListUomRatesDTO {
  uomId?: string;
}
