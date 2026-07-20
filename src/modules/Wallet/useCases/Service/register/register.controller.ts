import * as express from 'express';
import { BaseController } from '../../../../../core/infra/BaseController';
import RegisterServiceUseCase from './register.use-case';
import { RegisterServiceDTO } from '../../../DTO/registeredServiceDTO';

export default class RegisterServiceController extends BaseController {
  constructor(private readonly useCase: RegisterServiceUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: RegisterServiceDTO = {
      name: req.body?.name,
      description: req.body?.description ?? null,
      requestedBy: req.user?.id,
      actor: req.user,
    };

    try {
      const result = await this.useCase.execute(dto);
      if (result.isRight()) {
        // The apiKey is shown ONCE here — store it now; it can't be retrieved later.
        return this.created(res, result.value.getValue());
      }
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
