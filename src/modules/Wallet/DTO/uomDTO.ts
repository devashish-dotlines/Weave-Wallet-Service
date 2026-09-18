export interface CreateUomDTO {
  name: string;
  code: string;
  symbol?: string;
  /** A LOCAL unit category (POINTS, TIME, DATA …). */
  categoryId: string;
  /** How many of the category's base unit one of this is; defaults to 1. */
  factorToBase?: number;
  isActive?: boolean;
  requestedBy: string;
}

/** Code and category are fixed once created (wallets reference the unit). */
export interface UpdateUomDTO {
  id: string;
  name?: string;
  symbol?: string;
  factorToBase?: number;
  isActive?: boolean;
  requestedBy: string;
}

export interface UomDTO {
  id: string;
  name: string;
  code: string;
  symbol?: string;
  categoryId: string;
  factorToBase: number;
  isActive: boolean;
}
