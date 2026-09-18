import { uomCategoryRepo, uomRepo } from '../../repos';
import { unitRegistry } from '../../services';
import {
  ListUomCategoriesUseCase,
  UpdateUomCategoryUseCase,
  ListUnitsUseCase,
} from './uomCategory.use-cases';
import {
  ListUomCategoriesController,
  UpdateUomCategoryController,
  ListUnitsController,
} from './uomCategory.controller';

export const listUomCategoriesController = new ListUomCategoriesController(
  new ListUomCategoriesUseCase(uomCategoryRepo),
);
export const updateUomCategoryController = new UpdateUomCategoryController(
  new UpdateUomCategoryUseCase(uomCategoryRepo, uomRepo),
);
export const listUnitsController = new ListUnitsController(
  new ListUnitsUseCase(uomCategoryRepo, unitRegistry),
);
