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

const setWalletUsageRestrictionsUseCase = new SetWalletUsageRestrictionsUseCase(
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
