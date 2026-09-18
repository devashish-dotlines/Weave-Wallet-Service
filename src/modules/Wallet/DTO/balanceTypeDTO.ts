export interface CreateBalanceTypeDTO {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  /** The unit category this balance holds (CURRENCY, POINTS, TIME, DATA …). */
  categoryId: string;
  /**
   * Units of that category — acc_currency ids for CURRENCY, wlt_uom ids
   * otherwise. Omitted/empty ⇒ any unit of the category.
   */
  allowedUnitIds?: string[];
  requestedBy: string;
}

/** The category is fixed once created: wallets already hold units of it. */
export interface UpdateBalanceTypeDTO {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  /**
   * Replaces the whole list when present (send `[]` for any unit of the
   * category). Omit the field to leave the existing list untouched.
   */
  allowedUnitIds?: string[];
  requestedBy: string;
}

export interface BalanceTypeDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  categoryId: string;
  allowedUnitIds: string[];
}
