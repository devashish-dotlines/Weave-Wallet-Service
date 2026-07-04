import { walletTypeRepo } from '../../repos';
import {
  CreateWalletTypeUseCase,
  UpdateWalletTypeUseCase,
  DeleteWalletTypeUseCase,
  ListWalletTypeUseCase,
} from './walletType.use-cases';
import {
  CreateWalletTypeController,
  UpdateWalletTypeController,
  DeleteWalletTypeController,
  ListWalletTypeController,
} from './walletType.controller';

const createWalletTypeUseCase = new CreateWalletTypeUseCase(walletTypeRepo);
const updateWalletTypeUseCase = new UpdateWalletTypeUseCase(walletTypeRepo);
const deleteWalletTypeUseCase = new DeleteWalletTypeUseCase(walletTypeRepo);
const listWalletTypeUseCase = new ListWalletTypeUseCase(walletTypeRepo);

export const createWalletTypeController = new CreateWalletTypeController(
  createWalletTypeUseCase,
);
export const updateWalletTypeController = new UpdateWalletTypeController(
  updateWalletTypeUseCase,
);
export const deleteWalletTypeController = new DeleteWalletTypeController(
  deleteWalletTypeUseCase,
);
export const listWalletTypeController = new ListWalletTypeController(
  listWalletTypeUseCase,
);
