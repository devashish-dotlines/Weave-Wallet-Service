import { Wallet } from '../../domain/wallet';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';

/** Engine status projection applied to the denormalized cache (FR-WF-2). */
export interface WalletStatusProjection {
  statusId: string;
  /** The status slug/name (mirrors WorkflowInstance.current_status). */
  name?: string;
  color?: string | null;
}

export interface IWalletRepo {
  exists(id: string): Promise<boolean>;
  findById(id: string): Promise<Wallet | null>;
  findByCode(code: string): Promise<Wallet | null>;
  list(): Promise<Wallet[]>;
  create(domainObject: Wallet): Promise<string | null>;
  update(domainObject: Wallet): Promise<string | null>;
  setWorkflowStatus(id: string, s: WalletStatusProjection): Promise<void>;
  /** Overwrite the cached balance (used by recompute-from-transactions). */
  setBalance(id: string, balance: number, requestedBy: string): Promise<void>;
  delete(dto: DeleteDTO): Promise<string | null>;
}
