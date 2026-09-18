import { Wallet } from '../domain/wallet';
import { IOwnerTypeRepo } from '../repos/interface/IOwnerTypeRepo';
import {
  PrincipalResolver,
  ResolvedPrincipal,
} from '../../../infra/grpc/clients/permissionClient';

/** Ownership could not be decided (Accounts unreachable / not wired). */
export class OwnershipUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OwnershipUnavailableError';
  }
}

/**
 * Decides whether a gateway principal owns a wallet, for the self-service
 * ("my wallets") routes. Identity, not permission: superusers get no bypass —
 * admins act through the permission-gated admin routes instead.
 *
 *   USER         owner id is the caller's Accounts user_ref id (or, for wallets
 *                keyed directly by the gateway subject, the Keycloak sub)
 *   ORGANIZATION owner id is the organization the caller belongs to
 *   anything else (CUSTOMER, PARTNER, …) is never self-service owned
 *
 * An inactive or unknown Accounts user owns nothing.
 */
export class WalletOwnershipService {
  constructor(
    private readonly ownerTypeRepo: IOwnerTypeRepo,
    private readonly principals: PrincipalResolver | null,
  ) {}

  /** Throws OwnershipUnavailableError when Accounts can't be consulted. */
  async owns(keycloakSub: string, wallet: Wallet): Promise<boolean> {
    if (!keycloakSub) return false;
    const ownerType = await this.ownerTypeRepo.findById(wallet.ownerTypeId);
    if (!ownerType) return false;

    const code = ownerType.code.toUpperCase();
    if (code !== 'USER' && code !== 'ORGANIZATION') return false;

    const principal = await this.resolve(keycloakSub);
    if (!principal || !principal.active) return false;

    if (code === 'USER') {
      return (
        wallet.ownerId === principal.userRefId || wallet.ownerId === keycloakSub
      );
    }
    return (
      !!principal.organizationId && wallet.ownerId === principal.organizationId
    );
  }

  private async resolve(keycloakSub: string): Promise<ResolvedPrincipal | null> {
    if (!this.principals) {
      throw new OwnershipUnavailableError(
        'Accounts is not configured (ACCOUNTS_GRPC_TARGET); ownership cannot be verified',
      );
    }
    try {
      return await this.principals.resolvePrincipal(keycloakSub);
    } catch (err) {
      throw new OwnershipUnavailableError((err as Error).message);
    }
  }
}
