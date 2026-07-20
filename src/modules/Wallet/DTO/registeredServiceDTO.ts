import { IUser } from '../../../core/interface/iuser';

export interface RegisterServiceDTO {
  name: string;
  description?: string | null;

  requestedBy?: string;
  actor?: IUser;
}

export interface RevokeServiceDTO {
  id: string;
  requestedBy?: string;
  actor?: IUser;
}

/** Catalog view — never includes the secret. */
export interface RegisteredServiceResponseDTO {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

/** Returned ONCE on registration — the only time the raw key is exposed. */
export interface RegisteredServiceSecretDTO {
  id: string;
  name: string;
  apiKey: string;
}
