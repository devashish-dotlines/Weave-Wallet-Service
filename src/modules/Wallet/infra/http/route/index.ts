import express from 'express';
import {
  requirePermission,
  requireAnyPermission,
} from '../../../../../infra/permissions/permission';
import { requireWalletOwner } from '../middleware/requireWalletOwner';
import { uploadSingleFile } from '../middleware/uploadSingleFile';
import { PERMISSIONS } from '../../permissions/permissionCatalog';
import {
  createBalanceTypeController,
  updateBalanceTypeController,
  deleteBalanceTypeController,
  listBalanceTypeController,
} from '../../../useCases/balanceType';
import {
  createUomController,
  updateUomController,
  deleteUomController,
  listUomController,
} from '../../../useCases/uom';
import {
  listUomCategoriesController,
  updateUomCategoryController,
  listUnitsController,
} from '../../../useCases/uomCategory';
import {
  listUomRatesController,
  createUomRateController,
} from '../../../useCases/uomRate';
import {
  createUsageDimensionController,
  updateUsageDimensionController,
  deleteUsageDimensionController,
  listUsageDimensionController,
} from '../../../useCases/usageDimension';
import {
  setWalletUsageRestrictionsController,
  listWalletUsageRestrictionsController,
} from '../../../useCases/walletUsageRestriction';
import {
  createOwnerTypeController,
  updateOwnerTypeController,
  deleteOwnerTypeController,
  listOwnerTypeController,
} from '../../../useCases/ownerType';
import {
  createWalletTypeController,
  updateWalletTypeController,
  deleteWalletTypeController,
  listWalletTypeController,
} from '../../../useCases/walletType';
import {
  createWalletController,
  updateWalletController,
  deleteWalletController,
  getWalletController,
  listWalletController,
} from '../../../useCases/wallet';
import {
  creditWalletController,
  debitWalletController,
  transferController,
  recomputeWalletBalanceController,
  listWalletTransactionsController,
  getWalletTransactionController,
} from '../../../useCases/walletTransaction';
import {
  registerServiceController,
  listServicesController,
  revokeServiceController,
} from '../../../useCases/Service';
import {
  listTopupBankAccountsController,
  createTopupRequestController,
  uploadTopupAttachmentController,
  deleteTopupAttachmentController,
  submitTopupRequestController,
  cancelTopupRequestController,
  getTopupRequestController,
  listTopupTransitionsController,
  listWalletTopupRequestsController,
  listAllTopupRequestsController,
  reviewTopupRequestController,
  downloadTopupAttachmentController,
} from '../../../useCases/topupRequest';
import {
  lookupTransferRecipientController,
  selfTransferController,
} from '../../../useCases/transfer';

const walletRouter = express.Router();

// Registered services (service-to-service API keys). Issue/list/revoke opaque
// keys consumers present as `x-api-key`. The raw key is returned ONCE on
// registration and never again.
walletRouter.post('/services', requirePermission(PERMISSIONS.SERVICE_MANAGE), (req, res) =>
  registerServiceController.execute(req, res),
);
walletRouter.get('/services', requirePermission(PERMISSIONS.SERVICE_MANAGE), (req, res) =>
  listServicesController.execute(req, res),
);
walletRouter.post('/services/:id/revoke', requirePermission(PERMISSIONS.SERVICE_MANAGE), (req, res) =>
  revokeServiceController.execute(req, res),
);

// Balance types (FR-WL-2)
walletRouter.get('/balance-types', requirePermission(PERMISSIONS.BALANCE_TYPE_READ), (req, res) =>
  listBalanceTypeController.execute(req, res),
);
walletRouter.post('/balance-types', requirePermission(PERMISSIONS.BALANCE_TYPE_CREATE), (req, res) =>
  createBalanceTypeController.execute(req, res),
);
walletRouter.put('/balance-types/:id', requirePermission(PERMISSIONS.BALANCE_TYPE_UPDATE), (req, res) =>
  updateBalanceTypeController.execute(req, res),
);
walletRouter.delete('/balance-types/:id', requirePermission(PERMISSIONS.BALANCE_TYPE_DELETE), (req, res) =>
  deleteBalanceTypeController.execute(req, res),
);

// Usage dimensions — admin-defined axes a wallet's balance can be restricted
// along (CALL_TYPE, TIME_BAND, …), with their permitted values.
walletRouter.get('/usage-dimensions', requirePermission(PERMISSIONS.USAGE_DIMENSION_READ), (req, res) =>
  listUsageDimensionController.execute(req, res),
);
walletRouter.post('/usage-dimensions', requirePermission(PERMISSIONS.USAGE_DIMENSION_CREATE), (req, res) =>
  createUsageDimensionController.execute(req, res),
);
walletRouter.put('/usage-dimensions/:id', requirePermission(PERMISSIONS.USAGE_DIMENSION_UPDATE), (req, res) =>
  updateUsageDimensionController.execute(req, res),
);
walletRouter.delete('/usage-dimensions/:id', requirePermission(PERMISSIONS.USAGE_DIMENSION_DELETE), (req, res) =>
  deleteUsageDimensionController.execute(req, res),
);

// Units of measure — the wallet's value unit (UOM replaces currency)
walletRouter.get('/uoms', requirePermission(PERMISSIONS.UOM_READ), (req, res) =>
  listUomController.execute(req, res),
);
walletRouter.post('/uoms', requirePermission(PERMISSIONS.UOM_CREATE), (req, res) =>
  createUomController.execute(req, res),
);
walletRouter.put('/uoms/:id', requirePermission(PERMISSIONS.UOM_UPDATE), (req, res) =>
  updateUomController.execute(req, res),
);
// Unit categories (CURRENCY, POINTS, TIME, DATA …): seeded; name, valued,
// decimals and base unit are tunable. `/units` lists every unit of one
// category wherever it lives — accounting currencies or wallet UOMs.
walletRouter.get('/uom-categories', requirePermission(PERMISSIONS.UOM_CATEGORY_READ), (req, res) =>
  listUomCategoriesController.execute(req, res),
);
walletRouter.put('/uom-categories/:id', requirePermission(PERMISSIONS.UOM_CATEGORY_UPDATE), (req, res) =>
  updateUomCategoryController.execute(req, res),
);
// Any wallet-config reader needs units for pickers (balance types, wallets,
// wallet types), so this is gated on the broadest of those reads.
walletRouter.get('/units', requirePermission(PERMISSIONS.UOM_READ), (req, res) =>
  listUnitsController.execute(req, res),
);
// Unit rates: what one unit of a UOM is worth in the accounting BASE currency
// (1 POINT = 30 BDT). Effective-dated and append-only, so an old top-up keeps
// the rate it was created with. A currency-denominated UOM needs no row.
walletRouter.get('/uom-rates', requirePermission(PERMISSIONS.UOM_RATE_READ), (req, res) =>
  listUomRatesController.execute(req, res),
);
walletRouter.post('/uom-rates', requirePermission(PERMISSIONS.UOM_RATE_MANAGE), (req, res) =>
  createUomRateController.execute(req, res),
);
walletRouter.delete('/uoms/:id', requirePermission(PERMISSIONS.UOM_DELETE), (req, res) =>
  deleteUomController.execute(req, res),
);

// Owner types — the kind of entity that owns a wallet (Customer, Partner, …)
walletRouter.get('/owner-types', requirePermission(PERMISSIONS.OWNER_TYPE_READ), (req, res) =>
  listOwnerTypeController.execute(req, res),
);
walletRouter.post('/owner-types', requirePermission(PERMISSIONS.OWNER_TYPE_CREATE), (req, res) =>
  createOwnerTypeController.execute(req, res),
);
walletRouter.put('/owner-types/:id', requirePermission(PERMISSIONS.OWNER_TYPE_UPDATE), (req, res) =>
  updateOwnerTypeController.execute(req, res),
);
walletRouter.delete('/owner-types/:id', requirePermission(PERMISSIONS.OWNER_TYPE_DELETE), (req, res) =>
  deleteOwnerTypeController.execute(req, res),
);

// Wallet types (FR-WT-1)
walletRouter.get('/wallet-types', requirePermission(PERMISSIONS.WALLET_TYPE_READ), (req, res) =>
  listWalletTypeController.execute(req, res),
);
walletRouter.post('/wallet-types', requirePermission(PERMISSIONS.WALLET_TYPE_CREATE), (req, res) =>
  createWalletTypeController.execute(req, res),
);
walletRouter.put('/wallet-types/:id', requirePermission(PERMISSIONS.WALLET_TYPE_UPDATE), (req, res) =>
  updateWalletTypeController.execute(req, res),
);
walletRouter.delete('/wallet-types/:id', requirePermission(PERMISSIONS.WALLET_TYPE_DELETE), (req, res) =>
  deleteWalletTypeController.execute(req, res),
);

// Wallets (FR-WL-1)
walletRouter.get('/wallets', requirePermission(PERMISSIONS.WALLET_READ), (req, res) =>
  listWalletController.execute(req, res),
);
walletRouter.post('/wallets', requirePermission(PERMISSIONS.WALLET_CREATE), (req, res) =>
  createWalletController.execute(req, res),
);
walletRouter.get('/wallets/:id', requirePermission(PERMISSIONS.WALLET_READ), (req, res) =>
  getWalletController.execute(req, res),
);
walletRouter.put('/wallets/:id', requirePermission(PERMISSIONS.WALLET_UPDATE), (req, res) =>
  updateWalletController.execute(req, res),
);
walletRouter.delete('/wallets/:id', requirePermission(PERMISSIONS.WALLET_DELETE), (req, res) =>
  deleteWalletController.execute(req, res),
);

// Wallet usage restrictions — what this balance may be spent on. PUT replaces
// the whole set; an empty set means unrestricted. Rides the wallet's own perms.
walletRouter.get('/wallets/:id/usage-restrictions', requirePermission(PERMISSIONS.WALLET_READ), (req, res) =>
  listWalletUsageRestrictionsController.execute(req, res),
);
walletRouter.put('/wallets/:id/usage-restrictions', requirePermission(PERMISSIONS.WALLET_UPDATE), (req, res) =>
  setWalletUsageRestrictionsController.execute(req, res),
);

// Wallet transactions — balance-affecting operations. Each writes a
// WalletTransaction row and atomically updates the wallet's cached balance.
// (Double-entry ledger + GL posting are deferred.)
walletRouter.post('/wallets/:id/topup', requirePermission(PERMISSIONS.TRANSACTION_CREDIT), (req, res) =>
  creditWalletController.execute(req, res),
);
walletRouter.post('/wallets/:id/debit', requirePermission(PERMISSIONS.TRANSACTION_DEBIT), (req, res) =>
  debitWalletController.execute(req, res),
);
walletRouter.post('/wallets/:id/transfer', requirePermission(PERMISSIONS.TRANSACTION_TRANSFER), (req, res) =>
  transferController.execute(req, res),
);
// Recompute the cached balance from transaction history (interim ledger).
walletRouter.post('/wallets/:id/recompute', requirePermission(PERMISSIONS.TRANSACTION_RECOMPUTE), (req, res) =>
  recomputeWalletBalanceController.execute(req, res),
);
walletRouter.get('/wallets/:id/transactions', requirePermission(PERMISSIONS.TRANSACTION_READ), (req, res) =>
  listWalletTransactionsController.execute(req, res),
);
walletRouter.get('/transactions/:txId', requirePermission(PERMISSIONS.TRANSACTION_READ), (req, res) =>
  getWalletTransactionController.execute(req, res),
);

// Top-up requests — manual bank deposits, approved through the workflow engine.
// Owner routes need `wallet.self.topup` AND ownership of the wallet (checked by
// requireWalletOwner for :walletId routes, inside the use case for :id routes).
// A request or wallet the caller doesn't own answers 404.
// Funding options depend on the wallet's UOM (which currencies convert into it
// and at what rate), so they are read per wallet, behind the ownership guard.
walletRouter.get(
  '/my-wallets/:walletId/topup/bank-accounts',
  requirePermission(PERMISSIONS.SELF_TOPUP),
  requireWalletOwner('walletId'),
  (req, res) => listTopupBankAccountsController.execute(req, res),
);
walletRouter.post(
  '/my-wallets/:walletId/topup-requests',
  requirePermission(PERMISSIONS.SELF_TOPUP),
  requireWalletOwner('walletId'),
  (req, res) => createTopupRequestController.execute(req, res),
);
walletRouter.get(
  '/my-wallets/:walletId/topup-requests',
  requirePermission(PERMISSIONS.SELF_TOPUP),
  requireWalletOwner('walletId'),
  (req, res) => listWalletTopupRequestsController.execute(req, res),
);
// Staff raising a request on the owner's behalf: same flow, any wallet, gated by
// wallet.topup-request.create instead of ownership. The :id routes below then
// accept whoever raised the request (TopupRequestAccess.canAct).
walletRouter.get(
  '/wallets/:walletId/topup/bank-accounts',
  requirePermission(PERMISSIONS.TOPUP_REQUEST_CREATE),
  (req, res) => listTopupBankAccountsController.execute(req, res),
);
walletRouter.post(
  '/wallets/:walletId/topup-requests',
  requirePermission(PERMISSIONS.TOPUP_REQUEST_CREATE),
  (req, res) => createTopupRequestController.execute(req, res),
);
walletRouter.get(
  '/wallets/:walletId/topup-requests',
  requireAnyPermission([PERMISSIONS.TOPUP_REQUEST_READ, PERMISSIONS.TOPUP_REQUEST_CREATE]),
  (req, res) => listWalletTopupRequestsController.execute(req, res),
);
const TOPUP_REQUESTER = [PERMISSIONS.SELF_TOPUP, PERMISSIONS.TOPUP_REQUEST_CREATE];
walletRouter.post(
  '/topup-requests/:id/attachments',
  requireAnyPermission(TOPUP_REQUESTER),
  uploadSingleFile('file'),
  (req, res) => uploadTopupAttachmentController.execute(req, res),
);
walletRouter.delete(
  '/topup-requests/:id/attachments/:attachmentId',
  requireAnyPermission(TOPUP_REQUESTER),
  (req, res) => deleteTopupAttachmentController.execute(req, res),
);
walletRouter.post('/topup-requests/:id/submit', requireAnyPermission(TOPUP_REQUESTER), (req, res) =>
  submitTopupRequestController.execute(req, res),
);
walletRouter.post('/topup-requests/:id/cancel', requireAnyPermission(TOPUP_REQUESTER), (req, res) =>
  cancelTopupRequestController.execute(req, res),
);
// Shared owner/reviewer reads — the use case decides what this caller may see.
walletRouter.get(
  '/topup-requests/:id',
  requireAnyPermission([...TOPUP_REQUESTER, PERMISSIONS.TOPUP_REQUEST_READ]),
  (req, res) => getTopupRequestController.execute(req, res),
);
walletRouter.get(
  '/topup-requests/:id/attachments/:attachmentId/content',
  requireAnyPermission([...TOPUP_REQUESTER, PERMISSIONS.TOPUP_REQUEST_ATTACHMENT_READ]),
  (req, res) => downloadTopupAttachmentController.execute(req, res),
);
// Reviewer routes.
walletRouter.get('/topup-requests', requirePermission(PERMISSIONS.TOPUP_REQUEST_READ), (req, res) =>
  listAllTopupRequestsController.execute(req, res),
);
walletRouter.get(
  '/topup-requests/:id/transitions',
  requirePermission(PERMISSIONS.TOPUP_REQUEST_WORKFLOW_READ),
  (req, res) => listTopupTransitionsController.execute(req, res),
);
walletRouter.post(
  '/topup-requests/:id/review',
  requirePermission(PERMISSIONS.TOPUP_REQUEST_REVIEW),
  (req, res) => reviewTopupRequestController.execute(req, res),
);

// Self-service transfers out of a wallet the caller owns. Instant, limited by
// WALLET_TOPUP.limits.transfer (per transfer + daily). The recipient lookup is a
// separate path so it can't be shadowed by GET /wallets/:id.
walletRouter.get('/transfer-recipients', requirePermission(PERMISSIONS.SELF_TRANSFER), (req, res) =>
  lookupTransferRecipientController.execute(req, res),
);
walletRouter.post(
  '/my-wallets/:walletId/transfers',
  requirePermission(PERMISSIONS.SELF_TRANSFER),
  requireWalletOwner('walletId'),
  (req, res) => selfTransferController.execute(req, res),
);

export { walletRouter };
