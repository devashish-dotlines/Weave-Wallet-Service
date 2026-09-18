import { workflowEntities } from '../../../../infra/workflow';
import { config } from '../../../../config';
import { walletRepo, topupRequestRepo } from '../../repos';
import { PERMISSIONS } from '../permissions/permissionCatalog';

/**
 * The Wallet module owns the `wallet` entity in the workflow engine (FR-WL-6 /
 * FR-WF-1). It registers its env-supplied workflowType id plus its existence +
 * status-projection policy, so the engine's status push (EntityStatusService)
 * and initiate-on-create both serve it generically.
 *
 * The `entityType` string is a stable contract with the engine (must match the
 * WorkflowType's configured entity_type); only the workflowType id is env.
 */
export const WALLET_ENTITY = 'wallet';

/**
 * Manual bank-deposit top-up requests. Engine statuses (by slug) the wallet
 * relies on: reviewers move `submitted`/`under-review` → `approved` | `rejected`;
 * owners may move to `cancelled` where the rules allow; the `approved`
 * transition carries the `credit-wallet-topup` action rule, which moves the
 * instance on to `credited` once the credit succeeds.
 */
export const TOPUP_REQUEST_ENTITY = 'wallet_topup_request';
export const TOPUP_STATUS_SLUGS = {
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
} as const;

let registered = false;

/** Register the Wallet module's workflow entities. Idempotent. */
export function registerWalletWorkflowEntities(): void {
  if (registered) return;

  workflowEntities.register(WALLET_ENTITY, {
    workflowTypeId: config.workflow.walletTypeId,
    exists: (entityId) => walletRepo.exists(entityId),
    // Workflow is authoritative for a wallet's status; project the engine's
    // current status onto the denormalised wallet.status cache (FR-WF-2) so
    // reads/lists reflect it without an engine call.
    syncStatus: (entityId, status) =>
      walletRepo.setWorkflowStatus(entityId, {
        statusId: status.statusId,
        name: status.name,
        color: status.color,
      }),
    requiredPermissions: {
      status: PERMISSIONS.WALLET_WORKFLOW_READ,
      transition: PERMISSIONS.WALLET_WORKFLOW_TRANSITION,
    },
  });

  workflowEntities.register(TOPUP_REQUEST_ENTITY, {
    workflowTypeId: config.workflow.topupRequestTypeId,
    exists: (entityId) => topupRequestRepo.exists(entityId),
    // Status display only. The request's own `state` (what may be edited,
    // whether money moved) is changed by the wallet's use cases, never here.
    syncStatus: (entityId, status) =>
      topupRequestRepo.setWorkflowStatus(entityId, {
        statusId: status.statusId,
        statusName: status.name,
        statusColor: status.color ?? undefined,
        statusClosed: status.closed,
      }),
    requiredPermissions: {
      status: PERMISSIONS.TOPUP_REQUEST_WORKFLOW_READ,
      transition: PERMISSIONS.TOPUP_REQUEST_REVIEW,
    },
  });

  registered = true;
}
