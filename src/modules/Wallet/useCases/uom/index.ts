import { uomRepo } from '../../repos';
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

const createUomUseCase = new CreateUomUseCase(uomRepo);
const updateUomUseCase = new UpdateUomUseCase(uomRepo);
const deleteUomUseCase = new DeleteUomUseCase(uomRepo);
const listUomUseCase = new ListUomUseCase(uomRepo);

export const createUomController = new CreateUomController(createUomUseCase);
export const updateUomController = new UpdateUomController(updateUomUseCase);
export const deleteUomController = new DeleteUomController(deleteUomUseCase);
export const listUomController = new ListUomController(listUomUseCase);
