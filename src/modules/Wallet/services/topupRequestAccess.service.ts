import { IUser } from '../../../core/interface/iuser';
import { hasPermission } from '../../../infra/permissions/permission';
import { PERMISSIONS } from '../infra/permissions/permissionCatalog';
import { TopupRequest } from '../domain/topupRequest';
import { IWalletRepo } from '../repos/interface/IWalletRepo';
import { WalletOwnershipService } from './walletOwnership.service';

/**
 * Who may see or act on a top-up request. Three audiences:
 *   - the OWNER of the request's wallet (self-service: draft, upload, submit,
 *     cancel, view) — decided by wallet ownership, not by a permission;
 *   - STAFF with `wallet.topup-request.create`, who raise a request on the
 *     owner's behalf and may then act on the requests THEY raised;
 *   - REVIEWERS, who see every request through permissions.
 *
 * Ownership lookups may throw OwnershipUnavailableError (Accounts down); callers
 * surface that as a failure rather than a denial.
 */
export class TopupRequestAccess {
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly ownership: WalletOwnershipService,
  ) {}

  async isOwner(actor: IUser | undefined, request: TopupRequest): Promise<boolean> {
    if (!actor?.id) return false;
    const wallet = await this.walletRepo.findById(request.walletId);
    if (!wallet) return false;
    return this.ownership.owns(actor.id, wallet);
  }

  /** Staff who raised this request for the owner. */
  raisedOnBehalf(actor: IUser | undefined, request: TopupRequest): boolean {
    return (
      !!actor?.id &&
      request.requestedBy === actor.id &&
      hasPermission(actor, PERMISSIONS.TOPUP_REQUEST_CREATE)
    );
  }

  /** Draft, upload, submit, cancel: the owner, or the staff member who raised it. */
  async canAct(actor: IUser | undefined, request: TopupRequest): Promise<boolean> {
    if (this.raisedOnBehalf(actor, request)) return true;
    return this.isOwner(actor, request);
  }

  async canView(actor: IUser | undefined, request: TopupRequest): Promise<boolean> {
    if (hasPermission(actor, PERMISSIONS.TOPUP_REQUEST_READ)) return true;
    return this.canAct(actor, request);
  }

  async canDownloadAttachments(
    actor: IUser | undefined,
    request: TopupRequest,
  ): Promise<boolean> {
    if (hasPermission(actor, PERMISSIONS.TOPUP_REQUEST_ATTACHMENT_READ)) return true;
    return this.canAct(actor, request);
  }
}
