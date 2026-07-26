export interface CreateBalanceTypeDTO {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  /** UOMs this balance type may be denominated in. Omitted/empty ⇒ unrestricted. */
  allowedUomIds?: string[];
  requestedBy: string;
}

export interface UpdateBalanceTypeDTO {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  /**
   * Replaces the whole tag list when present (send `[]` to clear it back to
   * unrestricted). Omit the field to leave the existing tags untouched.
   */
  allowedUomIds?: string[];
  requestedBy: string;
}

export interface BalanceTypeDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  allowedUomIds: string[];
}
