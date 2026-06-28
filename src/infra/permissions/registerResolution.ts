import { Auth } from '../../core/middleware/auth';
import { permissionClient } from '../grpc/clients/permissionClient';

let registered = false;

/**
 * Wire `Auth.permissionResolver` to resolve a principal's permission codes from
 * Accounts (the single RBAC authority) over gRPC. Idempotent. If the Accounts
 * permission service isn't configured (no ACCOUNTS_GRPC_TARGET), the resolver is
 * left unset and `requirePermission` denies non-superusers by default.
 */
export function registerPermissionResolution(): void {
  if (registered) return;
  if (!permissionClient) {
    console.log(
      '[permission] ACCOUNTS_GRPC_TARGET not set — config-endpoint permissions ' +
        'will deny non-superusers (superusers still bypass).',
    );
    registered = true;
    return;
  }
  const client = permissionClient;
  Auth.permissionResolver = (roleRefs: string[]) => client.resolve(roleRefs);
  Auth.roleNameResolver = (roleIds: string[]) =>
    client.resolveRoleNames(roleIds);
  registered = true;
}
