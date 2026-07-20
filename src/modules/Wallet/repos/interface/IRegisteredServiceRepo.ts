import { RegisteredService } from '../../domain/registeredService';

export interface IRegisteredServiceRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<RegisteredService | null>;
  findByName(name: string): Promise<RegisteredService | null>;
  /** Resolve a service by its raw API key — active + non-voided only. */
  findByApiKey(apiKey: string): Promise<RegisteredService | null>;
  list(): Promise<RegisteredService[]>;
  create(domainObject: RegisteredService): Promise<string | null>;
  update(domainObject: RegisteredService): Promise<string | null>;
}
