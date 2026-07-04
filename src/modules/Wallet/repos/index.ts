import models from '../../../infra/sequelize/models';
import { BalanceTypeRepo } from './balanceTypeRepo';
import { UomRepo } from './uomRepo';
import { OwnerTypeRepo } from './ownerTypeRepo';
import { WalletTypeRepo } from './walletTypeRepo';
import { WalletRepo } from './walletRepo';
import { WalletTransactionRepo } from './walletTransactionRepo';

/**
 * Manually-instantiated repo singletons for the Wallet module (no DI container).
 * Each receives the whole `models` map and is injected into the module's
 * use-cases in `useCases/<resource>/index.ts`.
 */
export const balanceTypeRepo = new BalanceTypeRepo(models);
export const uomRepo = new UomRepo(models);
export const ownerTypeRepo = new OwnerTypeRepo(models);
export const walletTypeRepo = new WalletTypeRepo(models);
export const walletRepo = new WalletRepo(models);
export const walletTransactionRepo = new WalletTransactionRepo(models);
