import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  ListUomRatesUseCase,
  CreateUomRateUseCase,
} from './uomRate.use-cases';

export class ListUomRatesController extends BaseController {
  constructor(private readonly useCase: ListUomRatesUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const uomId = req.query.uomId ? String(req.query.uomId) : undefined;
      const result = await this.useCase.execute({ uomId });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class CreateUomRateController extends BaseController {
  constructor(private readonly useCase: CreateUomRateUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const b = req.body ?? {};
      const result = await this.useCase.execute({
        uomId: b.uomId,
        baseValue: b.baseValue,
        effectiveFrom: b.effectiveFrom,
        effectiveTo: b.effectiveTo,
        closeCurrent: b.closeCurrent,
        note: b.note,
        requestedBy: req.user?.id as string,
      });
      if (result.isRight()) return this.created(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
