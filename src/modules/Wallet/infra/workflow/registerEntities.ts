import { workflowEntities } from '../../../../infra/workflow';
import { config } from '../../../../config';
import { walletRepo } from '../../repos';
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

  registered = true;
}
