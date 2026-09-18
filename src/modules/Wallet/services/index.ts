import {
  walletRepo,
  ownerTypeRepo,
  walletTransactionRepo,
  topupRequestRepo,
  uomRateRepo,
  uomRepo,
  uomCategoryRepo,
} from '../repos';
import { config } from '../../../config';
import { ledgerClient } from '../../../infra/grpc/clients/ledgerClient';
import { GlPostingService } from './glPosting.service';
import { permissionClient } from '../../../infra/grpc/clients/permissionClient';
import { configClient } from '../../../infra/grpc/clients/configClient';
import { WalletOwnershipService } from './walletOwnership.service';
import { TopupConfigService } from './topupConfig.service';
import { CollectionAccountDirectory } from './collectionAccounts.service';
import { TopupRequestAccess } from './topupRequestAccess.service';
import { ConversionService } from './conversion.service';
import { CurrencyCatalog } from './currencyCatalog.service';
import { UnitRegistry } from './unitRegistry.service';

/** Wallet module service singletons (no DI container — plain top-level `new`). */
export const walletOwnership = new WalletOwnershipService(
  ownerTypeRepo,
  permissionClient,
);
export const topupConfig = new TopupConfigService(configClient);
// Org bank / MFS accounts payers send money to — owned by accounting.
export const collectionAccounts = new CollectionAccountDirectory(ledgerClient);
// Accounting currencies (CURRENCY-category units), cached; shared below.
export const currencyCatalog = new CurrencyCatalog(ledgerClient);
// Resolves a wallet's unit (category + unit id) wherever it lives.
export const unitRegistry = new UnitRegistry(uomCategoryRepo, uomRepo, currencyCatalog);
// Deposit currency -> wallet unit, anchored on accounting's base currency.
export const conversion = new ConversionService(currencyCatalog, uomRateRepo);
export const topupRequestAccess = new TopupRequestAccess(
  walletRepo,
  walletOwnership,
);
export const glPosting = new GlPostingService(
  ledgerClient,
  config.accounting.glPostingEnabled,
  walletTransactionRepo,
  walletRepo,
  topupRequestRepo,
  conversion,
  unitRegistry,
);
