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
  UOM_CATEGORY_READ: 'wallet.uom-category.read',
  UOM_CATEGORY_UPDATE: 'wallet.uom-category.update',
  UOM_RATE_READ: 'wallet.uom-rate.read',
  UOM_RATE_MANAGE: 'wallet.uom-rate.manage',

  OWNER_TYPE_CREATE: 'wallet.owner-type.create',
  OWNER_TYPE_READ: 'wallet.owner-type.read',
  OWNER_TYPE_UPDATE: 'wallet.owner-type.update',
  OWNER_TYPE_DELETE: 'wallet.owner-type.delete',

  WALLET_TYPE_CREATE: 'wallet.wallet-type.create',
  WALLET_TYPE_READ: 'wallet.wallet-type.read',
  WALLET_TYPE_UPDATE: 'wallet.wallet-type.update',
  WALLET_TYPE_DELETE: 'wallet.wallet-type.delete',

  USAGE_DIMENSION_CREATE: 'wallet.usage-dimension.create',
  USAGE_DIMENSION_READ: 'wallet.usage-dimension.read',
  USAGE_DIMENSION_UPDATE: 'wallet.usage-dimension.update',
  USAGE_DIMENSION_DELETE: 'wallet.usage-dimension.delete',

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

  // Top-up requests — review side (manual bank deposits awaiting approval).
  TOPUP_REQUEST_READ: 'wallet.topup-request.read',
  // Staff raising a request on any wallet on its owner's behalf. Still goes to
  // approval, and maker-checker stops the same person approving it.
  TOPUP_REQUEST_CREATE: 'wallet.topup-request.create',
  TOPUP_REQUEST_REVIEW: 'wallet.topup-request.review',
  TOPUP_REQUEST_WORKFLOW_READ: 'wallet.topup-request.workflow.read',
  TOPUP_REQUEST_ATTACHMENT_READ: 'wallet.topup-request.attachment.read',

  // Self-service on wallets the caller OWNS (ownership is checked separately).
  SELF_TOPUP: 'wallet.self.topup',
  SELF_TRANSFER: 'wallet.self.transfer',

  // Service registry — issue/list/revoke service-to-service API keys.
  SERVICE_MANAGE: 'wallet.service.manage',
} as const;
