/**
 * Permission codes the Wallet module's config/CRUD endpoints require.
 *
 * These codes are GRANTED in the Accounts service (the single RBAC authority)
 * under this service's module catalog and resolved at request time over gRPC —
 * keep this list in parity with Accounts' `wallet` catalog. Nothing is seeded
 * here; this is only the code vocabulary the routes gate on.
 */
export const PERMISSIONS = {
  BALANCE_TYPE_CREATE: 'wallet.balance-type.create',
  BALANCE_TYPE_READ: 'wallet.balance-type.read',
  BALANCE_TYPE_UPDATE: 'wallet.balance-type.update',
  BALANCE_TYPE_DELETE: 'wallet.balance-type.delete',

  UOM_CREATE: 'wallet.uom.create',
  UOM_READ: 'wallet.uom.read',
  UOM_UPDATE: 'wallet.uom.update',
  UOM_DELETE: 'wallet.uom.delete',

  OWNER_TYPE_CREATE: 'wallet.owner-type.create',
  OWNER_TYPE_READ: 'wallet.owner-type.read',
  OWNER_TYPE_UPDATE: 'wallet.owner-type.update',
  OWNER_TYPE_DELETE: 'wallet.owner-type.delete',

  WALLET_TYPE_CREATE: 'wallet.wallet-type.create',
  WALLET_TYPE_READ: 'wallet.wallet-type.read',
  WALLET_TYPE_UPDATE: 'wallet.wallet-type.update',
  WALLET_TYPE_DELETE: 'wallet.wallet-type.delete',

  WALLET_CREATE: 'wallet.wallet.create',
  WALLET_READ: 'wallet.wallet.read',
  WALLET_UPDATE: 'wallet.wallet.update',
  WALLET_DELETE: 'wallet.wallet.delete',

  // Wallet transactions (balance-affecting operations)
  TRANSACTION_READ: 'wallet.transaction.read',
  TRANSACTION_CREDIT: 'wallet.transaction.credit',
  TRANSACTION_DEBIT: 'wallet.transaction.debit',
  TRANSACTION_TRANSFER: 'wallet.transaction.transfer',
  TRANSACTION_RECOMPUTE: 'wallet.transaction.recompute',

  // Wallet workflow (FR-WL-6 / FR-WF-1), used by the generic /v1/workflow router.
  WALLET_WORKFLOW_READ: 'wallet.wallet.workflow.read',
  WALLET_WORKFLOW_TRANSITION: 'wallet.wallet.workflow.transition',
} as const;
