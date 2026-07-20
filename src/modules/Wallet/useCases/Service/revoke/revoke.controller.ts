import * as express from 'express';
import { BaseController } from '../../../../../core/infra/BaseController';
import RevokeServiceUseCase from './revoke.use-case';
import { RevokeServiceDTO } from '../../../DTO/registeredServiceDTO';

export default class RevokeServiceController extends BaseController {
  constructor(private readonly useCase: RevokeServiceUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: RevokeServiceDTO = {
      id: req.params.id,
      requestedBy: req.user?.id,
      actor: req.user,
    };

    try {
      const result = await this.useCase.execute(dto);
      if (result.isRight()) {
        return this.ok(res, { id: result.value.getValue(), revoked: true });
      }
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
