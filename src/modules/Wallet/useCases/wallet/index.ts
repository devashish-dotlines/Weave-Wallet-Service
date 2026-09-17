import {
  walletRepo,
  walletTypeRepo,
  balanceTypeRepo,
  uomRepo,
  ownerTypeRepo,
  usageDimensionRepo,
} from '../../repos';
import { setWalletUsageRestrictionsUseCase } from '../walletUsageRestriction';
import { creditWalletUseCase } from '../walletTransaction';
import { ProvisionWalletUseCase } from './provisionWallet.use-case';
import { config } from '../../../../config';
import { workflowIntegration } from '../../../../infra/workflow';
import { WALLET_ENTITY } from '../../infra/workflow/registerEntities';
import {
  CreateWalletUseCase,
  UpdateWalletUseCase,
  DeleteWalletUseCase,
  GetWalletUseCase,
  ListWalletUseCase,
  WalletWorkflowInitiator,
} from './wallet.use-cases';
import {
  CreateWalletController,
  UpdateWalletController,
  DeleteWalletController,
  GetWalletController,
  ListWalletController,
} from './wallet.controller';

// Initiate the wallet workflow via the engine when configured; skip otherwise
// so wallet creation still works in dev/test without the engine (status stays
// at the local default).
const workflowInitiator: WalletWorkflowInitiator = {
  async initiate(walletId, requestedBy, roleIds) {
    if (!config.workflow.grpcTarget || !config.workflow.walletTypeId) {
      return null;
    }
    const r = await workflowIntegration.initiate(WALLET_ENTITY, {
      entityId: walletId,
      requestedBy,
      roleIds,
    });
    return {
      statusId: r.statusId,
      statusName: r.statusName,
      statusColor: r.statusColor,
    };
  },
};

const createWalletUseCase = new CreateWalletUseCase(
  walletRepo,
  walletTypeRepo,
  balanceTypeRepo,
  uomRepo,
  ownerTypeRepo,
  workflowInitiator,
);
// Service-to-service provisioning. Shared with the gRPC handler; it has no HTTP
// controller on purpose — the panel creates wallets through the routes above.
export const provisionWalletUseCase = new ProvisionWalletUseCase(
  walletRepo,
  ownerTypeRepo,
  usageDimensionRepo,
  createWalletUseCase,
  setWalletUsageRestrictionsUseCase,
  creditWalletUseCase,
);

const updateWalletUseCase = new UpdateWalletUseCase(walletRepo);
const deleteWalletUseCase = new DeleteWalletUseCase(walletRepo);
const getWalletUseCase = new GetWalletUseCase(walletRepo);
const listWalletUseCase = new ListWalletUseCase(walletRepo);

export const createWalletController = new CreateWalletController(
  createWalletUseCase,
);
export const updateWalletController = new UpdateWalletController(
  updateWalletUseCase,
);
export const deleteWalletController = new DeleteWalletController(
  deleteWalletUseCase,
);
export const getWalletController = new GetWalletController(getWalletUseCase);
export const listWalletController = new ListWalletController(listWalletUseCase);
