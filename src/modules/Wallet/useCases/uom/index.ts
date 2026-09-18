import { uomRepo, uomCategoryRepo, balanceTypeRepo } from '../../repos';
import {
  CreateUomUseCase,
  UpdateUomUseCase,
  DeleteUomUseCase,
  ListUomUseCase,
} from './uom.use-cases';
import {
  CreateUomController,
  UpdateUomController,
  DeleteUomController,
  ListUomController,
} from './uom.controller';

const createUomUseCase = new CreateUomUseCase(uomRepo, uomCategoryRepo);
const updateUomUseCase = new UpdateUomUseCase(uomRepo);
const deleteUomUseCase = new DeleteUomUseCase(
  uomRepo,
  balanceTypeRepo,
  uomCategoryRepo,
);
const listUomUseCase = new ListUomUseCase(uomRepo);

export const createUomController = new CreateUomController(createUomUseCase);
export const updateUomController = new UpdateUomController(updateUomUseCase);
export const deleteUomController = new DeleteUomController(deleteUomUseCase);
export const listUomController = new ListUomController(listUomUseCase);
