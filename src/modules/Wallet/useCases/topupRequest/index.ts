import { topupRequestRepo, walletRepo, walletTypeRepo } from '../../repos';
import {
  topupConfig,
  collectionAccounts,
  topupRequestAccess,
  glPosting,
  conversion,
  unitRegistry,
} from '../../services';
import { objectStorage } from '../../../../infra/storage';
import { workflowIntegration } from '../../../../infra/workflow';
import { creditWalletUseCase } from '../walletTransaction';
import {
  ListTopupBankAccountsUseCase,
  CreateTopupRequestUseCase,
  UploadTopupAttachmentUseCase,
  DeleteTopupAttachmentUseCase,
  SubmitTopupRequestUseCase,
  CancelTopupRequestUseCase,
  GetTopupRequestUseCase,
  ListTopupRequestsUseCase,
  DownloadTopupAttachmentUseCase,
  ListTopupTransitionsUseCase,
  ReviewTopupRequestUseCase,
  CreditTopupRequestUseCase,
} from './topupRequest.use-cases';
import {
  ListTopupBankAccountsController,
  CreateTopupRequestController,
  UploadTopupAttachmentController,
  DeleteTopupAttachmentController,
  TopupRequestActionController,
  ListWalletTopupRequestsController,
  ListAllTopupRequestsController,
  ReviewTopupRequestController,
  DownloadTopupAttachmentController,
} from './topupRequest.controller';

const listTopupRequestsUseCase = new ListTopupRequestsUseCase(topupRequestRepo);

// Used by the engine's `credit-wallet-topup` action (registerActions.ts).
export const creditTopupRequestUseCase = new CreditTopupRequestUseCase(
  topupRequestRepo,
  creditWalletUseCase,
  glPosting,
);

export const listTopupBankAccountsController = new ListTopupBankAccountsController(
  new ListTopupBankAccountsUseCase(
    walletRepo,
    unitRegistry,
    walletTypeRepo,
    topupConfig,
    conversion,
    collectionAccounts,
  ),
);
export const createTopupRequestController = new CreateTopupRequestController(
  new CreateTopupRequestUseCase(
    topupRequestRepo,
    walletRepo,
    unitRegistry,
    walletTypeRepo,
    topupConfig,
    conversion,
    collectionAccounts,
  ),
);
export const uploadTopupAttachmentController = new UploadTopupAttachmentController(
  new UploadTopupAttachmentUseCase(topupRequestRepo, topupRequestAccess, objectStorage),
);
export const deleteTopupAttachmentController = new DeleteTopupAttachmentController(
  new DeleteTopupAttachmentUseCase(topupRequestRepo, topupRequestAccess),
);
export const submitTopupRequestController = new TopupRequestActionController(
  new SubmitTopupRequestUseCase(topupRequestRepo, topupRequestAccess, workflowIntegration),
);
export const cancelTopupRequestController = new TopupRequestActionController(
  new CancelTopupRequestUseCase(topupRequestRepo, topupRequestAccess, workflowIntegration),
);
export const getTopupRequestController = new TopupRequestActionController(
  new GetTopupRequestUseCase(topupRequestRepo, topupRequestAccess),
);
export const listTopupTransitionsController = new TopupRequestActionController(
  new ListTopupTransitionsUseCase(topupRequestRepo, workflowIntegration),
);
export const listWalletTopupRequestsController = new ListWalletTopupRequestsController(
  listTopupRequestsUseCase,
);
export const listAllTopupRequestsController = new ListAllTopupRequestsController(
  listTopupRequestsUseCase,
);
export const reviewTopupRequestController = new ReviewTopupRequestController(
  new ReviewTopupRequestUseCase(topupRequestRepo, topupRequestAccess, workflowIntegration),
);
export const downloadTopupAttachmentController = new DownloadTopupAttachmentController(
  new DownloadTopupAttachmentUseCase(topupRequestRepo, topupRequestAccess, objectStorage),
);
