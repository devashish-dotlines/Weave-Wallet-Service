import './infra/http/app';
import './infra/sequelize';

import { registerPermissionResolution } from './infra/permissions/registerResolution';
import { registerWalletWorkflowEntities } from './modules/Wallet/infra/workflow/registerEntities';
import { startGlReconciler } from './infra/worker/glReconciler';

// Wire Auth.permissionResolver to Accounts (the single RBAC authority) over gRPC.
// No-op/fail-closed when ACCOUNTS_GRPC_TARGET is unset. Must run at boot, before
// any request is served, so requirePermission(...) gates can resolve codes.
registerPermissionResolution();

// Populate the workflow-entity registry (wallet) so initiate-on-create can
// resolve its workflowType id. Idempotent.
registerWalletWorkflowEntities();

// Re-post wallet movements whose inline GL posting failed. No-op unless
// WALLET_GL_POSTING_ENABLED=true and accounting is configured.
startGlReconciler();
