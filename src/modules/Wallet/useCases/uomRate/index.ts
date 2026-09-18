import { uomRateRepo, uomRepo, uomCategoryRepo } from '../../repos';
import {
  ListUomRatesUseCase,
  CreateUomRateUseCase,
} from './uomRate.use-cases';
import {
  ListUomRatesController,
  CreateUomRateController,
} from './uomRate.controller';

export const listUomRatesController = new ListUomRatesController(
  new ListUomRatesUseCase(uomRateRepo, uomRepo),
);
export const createUomRateController = new CreateUomRateController(
  new CreateUomRateUseCase(uomRateRepo, uomRepo, uomCategoryRepo),
);
