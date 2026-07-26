import { usageDimensionRepo } from '../../repos';
import {
  CreateUsageDimensionUseCase,
  UpdateUsageDimensionUseCase,
  DeleteUsageDimensionUseCase,
  ListUsageDimensionUseCase,
} from './usageDimension.use-cases';
import {
  CreateUsageDimensionController,
  UpdateUsageDimensionController,
  DeleteUsageDimensionController,
  ListUsageDimensionController,
} from './usageDimension.controller';

const createUsageDimensionUseCase = new CreateUsageDimensionUseCase(
  usageDimensionRepo,
);
const updateUsageDimensionUseCase = new UpdateUsageDimensionUseCase(
  usageDimensionRepo,
);
const deleteUsageDimensionUseCase = new DeleteUsageDimensionUseCase(
  usageDimensionRepo,
);
const listUsageDimensionUseCase = new ListUsageDimensionUseCase(
  usageDimensionRepo,
);

export const createUsageDimensionController = new CreateUsageDimensionController(
  createUsageDimensionUseCase,
);
export const updateUsageDimensionController = new UpdateUsageDimensionController(
  updateUsageDimensionUseCase,
);
export const deleteUsageDimensionController = new DeleteUsageDimensionController(
  deleteUsageDimensionUseCase,
);
export const listUsageDimensionController = new ListUsageDimensionController(
  listUsageDimensionUseCase,
);
