import { UnitSource } from '../domain/uomCategory';

export interface UomCategoryDTO {
  id: string;
  code: string;
  name: string;
  unitSource: UnitSource;
  valued: boolean;
  decimals: number;
  baseUomId?: string;
  isActive: boolean;
}

/**
 * Code and unit source are fixed: unit ids already stored against the
 * category point into the table the source names.
 */
export interface UpdateUomCategoryDTO {
  id: string;
  name?: string;
  valued?: boolean;
  decimals?: number;
  /** LOCAL only; null clears it. */
  baseUomId?: string | null;
  isActive?: boolean;
  requestedBy: string;
}
