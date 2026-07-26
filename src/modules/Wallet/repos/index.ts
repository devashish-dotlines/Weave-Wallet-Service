import models from '../../../infra/sequelize/models';
import { Auth } from '../../../core/middleware/auth';
import { BalanceTypeRepo } from './balanceTypeRepo';
import { UomRepo } from './uomRepo';
import { OwnerTypeRepo } from './ownerTypeRepo';
import { WalletTypeRepo } from './walletTypeRepo';
import { WalletRepo } from './walletRepo';
import { WalletTransactionRepo } from './walletTransactionRepo';
import { RegisteredServiceRepo } from './registeredServiceRepo';
import { UsageDimensionRepo } from './usageDimensionRepo';
import { WalletUsageRestrictionRepo } from './walletUsageRestrictionRepo';

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
export const registeredServiceRepo = new RegisteredServiceRepo(models);
export const usageDimensionRepo = new UsageDimensionRepo(models);
export const walletUsageRestrictionRepo = new WalletUsageRestrictionRepo(models);

// DB-backed service-to-service auth: resolve the calling service from its
// presented API key against the registered_service table (active + non-voided) —
// issued via the /v1/wallet/services registration API. Backs both the gRPC and
// REST `Auth.authenticateAPIKey` gates. Revoking a service (isActive=false) stops
// its key resolving immediately, with no shared secret to rotate.
Auth.moduleApiKeyResolver = async (apiKey: string) => {
  const service = await registeredServiceRepo.findByApiKey(apiKey);
  if (!service) return null;
  return {
    id: service.id.toString(),
    name: service.name,
    apiKey,
  };
};
