export interface CreateOwnerTypeDTO {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface UpdateOwnerTypeDTO {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface OwnerTypeDTO {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}
