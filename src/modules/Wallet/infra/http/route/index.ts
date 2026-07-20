import express from 'express';
import { requirePermission } from '../../../../../infra/permissions/permission';
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

export { walletRouter };
