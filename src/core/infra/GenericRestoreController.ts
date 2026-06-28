import * as express from 'express';
import { BaseController } from './BaseController';
import { RestoreDTO } from '../DTO/restoreDTO';
import { UseCase } from '../domain/UseCase';

export default class GenericRestoreController<
  TUseCase extends UseCase<RestoreDTO, Promise<any>>,
> extends BaseController {
  constructor(private readonly useCase: TUseCase) {
    super();
  }

  protected async executeUseCase(dto: RestoreDTO): Promise<any> {
    return this.useCase.execute(dto);
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: RestoreDTO = {
      id: req.params.id,
      requestedBy: req.user?.id ?? '',
    };
    try {
      const result = await this.executeUseCase(dto);
      return this.handleDeleteOrRestore(res, result, 'Restored successfully');
    } catch (err) {
      return this.fail(res, err);
    }
  }
}
