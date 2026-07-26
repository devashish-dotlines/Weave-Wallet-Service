import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  SetWalletUsageRestrictionsUseCase,
  ListWalletUsageRestrictionsUseCase,
} from './walletUsageRestriction.use-cases';
import { SetWalletUsageRestrictionsDTO } from '../../DTO/walletUsageRestrictionDTO';

export class SetWalletUsageRestrictionsController extends BaseController {
  constructor(private readonly useCase: SetWalletUsageRestrictionsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: SetWalletUsageRestrictionsDTO = {
      restrictions: req.body?.restrictions ?? [],
      walletId: req.params.id,
      requestedBy: req.user?.id as string,
    };
    try {
      const result = await this.useCase.execute(dto);
      if (result.isRight()) {
        return this.ok(res, { message: 'Usage restrictions updated' });
      }
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListWalletUsageRestrictionsController extends BaseController {
  constructor(private readonly useCase: ListWalletUsageRestrictionsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(req.params.id);
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
