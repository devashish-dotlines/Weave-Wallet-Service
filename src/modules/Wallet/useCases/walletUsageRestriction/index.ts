import {
  walletUsageRestrictionRepo,
  walletRepo,
  usageDimensionRepo,
} from '../../repos';
import {
  SetWalletUsageRestrictionsUseCase,
  ListWalletUsageRestrictionsUseCase,
} from './walletUsageRestriction.use-cases';
import {
  SetWalletUsageRestrictionsController,
  ListWalletUsageRestrictionsController,
} from './walletUsageRestriction.controller';

// Exported so the provisioning use case reuses this exact instance rather than
// re-wiring an identical one.
export const setWalletUsageRestrictionsUseCase = new SetWalletUsageRestrictionsUseCase(
  walletUsageRestrictionRepo,
  walletRepo,
  usageDimensionRepo,
);
const listWalletUsageRestrictionsUseCase =
  new ListWalletUsageRestrictionsUseCase(
    walletUsageRestrictionRepo,
    usageDimensionRepo,
  );

export const setWalletUsageRestrictionsController =
  new SetWalletUsageRestrictionsController(setWalletUsageRestrictionsUseCase);
export const listWalletUsageRestrictionsController =
  new ListWalletUsageRestrictionsController(listWalletUsageRestrictionsUseCase);
