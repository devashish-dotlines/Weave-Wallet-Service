export interface CreateUomDTO {
  name: string;
  code: string;
  symbol?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface UpdateUomDTO {
  id: string;
  name?: string;
  symbol?: string;
  isActive?: boolean;
  requestedBy: string;
}

export interface UomDTO {
  id: string;
  name: string;
  code: string;
  symbol?: string;
  isActive: boolean;
}
