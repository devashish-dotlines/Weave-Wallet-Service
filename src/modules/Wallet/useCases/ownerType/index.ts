import { ownerTypeRepo } from '../../repos';
import {
  CreateOwnerTypeUseCase,
  UpdateOwnerTypeUseCase,
  DeleteOwnerTypeUseCase,
  ListOwnerTypeUseCase,
} from './ownerType.use-cases';
import {
  CreateOwnerTypeController,
  UpdateOwnerTypeController,
  DeleteOwnerTypeController,
  ListOwnerTypeController,
} from './ownerType.controller';

const createOwnerTypeUseCase = new CreateOwnerTypeUseCase(ownerTypeRepo);
const updateOwnerTypeUseCase = new UpdateOwnerTypeUseCase(ownerTypeRepo);
const deleteOwnerTypeUseCase = new DeleteOwnerTypeUseCase(ownerTypeRepo);
const listOwnerTypeUseCase = new ListOwnerTypeUseCase(ownerTypeRepo);

export const createOwnerTypeController = new CreateOwnerTypeController(
  createOwnerTypeUseCase,
);
export const updateOwnerTypeController = new UpdateOwnerTypeController(
  updateOwnerTypeUseCase,
);
export const deleteOwnerTypeController = new DeleteOwnerTypeController(
  deleteOwnerTypeUseCase,
);
export const listOwnerTypeController = new ListOwnerTypeController(
  listOwnerTypeUseCase,
);
