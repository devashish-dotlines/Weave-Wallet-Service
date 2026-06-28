import './infra/http/app';
import './infra/sequelize';

import { registerPermissionResolution } from './infra/permissions/registerResolution';

// Wire Auth.permissionResolver to Accounts (the single RBAC authority) over gRPC.
// No-op/fail-closed when ACCOUNTS_GRPC_TARGET is unset. Must run at boot, before
// any request is served, so requirePermission(...) gates can resolve codes.
registerPermissionResolution();
