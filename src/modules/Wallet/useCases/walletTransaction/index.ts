import {
  walletRepo,
  walletTypeRepo,
  walletTransactionRepo,
  walletUsageRestrictionRepo,
} from '../../repos';
import {
  CreditWalletUseCase,
  DebitWalletUseCase,
  TransferUseCase,
  RecomputeWalletBalanceUseCase,
  ListWalletTransactionsUseCase,
  GetWalletTransactionUseCase,
} from './walletTransaction.use-cases';
import {
  CreditWalletController,
  DebitWalletController,
  TransferController,
  RecomputeWalletBalanceController,
  ListWalletTransactionsController,
  GetWalletTransactionController,
} from './walletTransaction.controller';

// Exported so the provisioning use case funds a new wallet through this exact
// instance rather than re-wiring an identical one.
export const creditWalletUseCase = new CreditWalletUseCase(
  walletRepo,
  walletTransactionRepo,
);
const debitWalletUseCase = new DebitWalletUseCase(
  walletRepo,
  walletTypeRepo,
  walletTransactionRepo,
  walletUsageRestrictionRepo,
);
const transferUseCase = new TransferUseCase(
  walletRepo,
  walletTypeRepo,
  walletTransactionRepo,
  walletUsageRestrictionRepo,
);
const recomputeUseCase = new RecomputeWalletBalanceUseCase(
  walletRepo,
  walletTransactionRepo,
);
const listTxUseCase = new ListWalletTransactionsUseCase(walletTransactionRepo);
const getTxUseCase = new GetWalletTransactionUseCase(walletTransactionRepo);

export const creditWalletController = new CreditWalletController(
  creditWalletUseCase,
);
export const debitWalletController = new DebitWalletController(
  debitWalletUseCase,
);
export const transferController = new TransferController(transferUseCase);
export const recomputeWalletBalanceController =
  new RecomputeWalletBalanceController(recomputeUseCase);
export const listWalletTransactionsController =
  new ListWalletTransactionsController(listTxUseCase);
export const getWalletTransactionController = new GetWalletTransactionController(
  getTxUseCase,
);
