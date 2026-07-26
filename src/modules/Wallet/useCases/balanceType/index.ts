import { balanceTypeRepo, uomRepo } from '../../repos';
import {
  CreateBalanceTypeUseCase,
  UpdateBalanceTypeUseCase,
  DeleteBalanceTypeUseCase,
  ListBalanceTypeUseCase,
} from './balanceType.use-cases';
import {
  CreateBalanceTypeController,
  UpdateBalanceTypeController,
  DeleteBalanceTypeController,
  ListBalanceTypeController,
} from './balanceType.controller';

const createBalanceTypeUseCase = new CreateBalanceTypeUseCase(
  balanceTypeRepo,
  uomRepo,
);
const updateBalanceTypeUseCase = new UpdateBalanceTypeUseCase(
  balanceTypeRepo,
  uomRepo,
);
const deleteBalanceTypeUseCase = new DeleteBalanceTypeUseCase(balanceTypeRepo);
const listBalanceTypeUseCase = new ListBalanceTypeUseCase(balanceTypeRepo);

export const createBalanceTypeController = new CreateBalanceTypeController(
  createBalanceTypeUseCase,
);
export const updateBalanceTypeController = new UpdateBalanceTypeController(
  updateBalanceTypeUseCase,
);
export const deleteBalanceTypeController = new DeleteBalanceTypeController(
  deleteBalanceTypeUseCase,
);
export const listBalanceTypeController = new ListBalanceTypeController(
  listBalanceTypeUseCase,
);
