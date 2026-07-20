import * as express from 'express';
import { BaseController } from '../../../../../core/infra/BaseController';
import ListServicesUseCase from './list.use-case';

export default class ListServicesController extends BaseController {
  constructor(private readonly useCase: ListServicesUseCase) {
    super();
  }

  async executeImpl(_req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute();
      if (result.isRight()) {
        return this.ok(res, result.value.getValue());
      }
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
