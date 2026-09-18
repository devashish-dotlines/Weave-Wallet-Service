import { walletRepo } from '../../repos';
import { topupConfig, glPosting } from '../../services';
import { transferUseCase } from '../walletTransaction';
import {
  LookupTransferRecipientUseCase,
  SelfTransferUseCase,
} from './selfTransfer.use-cases';
import {
  LookupTransferRecipientController,
  SelfTransferController,
} from './selfTransfer.controller';

export const lookupTransferRecipientController = new LookupTransferRecipientController(
  new LookupTransferRecipientUseCase(walletRepo),
);
export const selfTransferController = new SelfTransferController(
  new SelfTransferUseCase(walletRepo, topupConfig, transferUseCase, glPosting),
);
