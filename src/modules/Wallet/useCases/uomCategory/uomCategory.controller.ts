import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  ListUomCategoriesUseCase,
  UpdateUomCategoryUseCase,
  ListUnitsUseCase,
} from './uomCategory.use-cases';

export class ListUomCategoriesController extends BaseController {
  constructor(private readonly useCase: ListUomCategoriesUseCase) {
    super();
  }

  async executeImpl(_req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute();
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class UpdateUomCategoryController extends BaseController {
  constructor(private readonly useCase: UpdateUomCategoryUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const b = req.body ?? {};
      const result = await this.useCase.execute({
        id: req.params.id,
        name: b.name,
        valued: b.valued,
        decimals: b.decimals,
        baseUomId: b.baseUomId,
        isActive: b.isActive,
        requestedBy: req.user?.id as string,
      });
      if (result.isRight()) return this.ok(res, { id: result.value.getValue() });
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListUnitsController extends BaseController {
  constructor(private readonly useCase: ListUnitsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(String(req.query.categoryId ?? ''));
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
