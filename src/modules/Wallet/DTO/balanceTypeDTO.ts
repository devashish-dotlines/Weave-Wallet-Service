export interface CreateBalanceTypeDTO {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface UpdateBalanceTypeDTO {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface BalanceTypeDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}
