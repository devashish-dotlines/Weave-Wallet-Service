import { walletRepo, walletTypeRepo, walletTransactionRepo } from '../../repos';
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

const creditWalletUseCase = new CreditWalletUseCase(
  walletRepo,
  walletTransactionRepo,
);
const debitWalletUseCase = new DebitWalletUseCase(
  walletRepo,
  walletTypeRepo,
  walletTransactionRepo,
);
const transferUseCase = new TransferUseCase(
  walletRepo,
  walletTypeRepo,
  walletTransactionRepo,
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
