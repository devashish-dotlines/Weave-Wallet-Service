import * as express from 'express';
import { BaseController } from './BaseController';
import { DeleteDTO } from '../DTO/deleteDTO';
import { UseCase } from '../domain/UseCase';

export default class GenericDeleteController<
  TUseCase extends UseCase<DeleteDTO, Promise<any>>,
> extends BaseController {
  constructor(private readonly useCase: TUseCase) {
    super();
  }

  protected async executeUseCase(dto: DeleteDTO): Promise<any> {
    return this.useCase.execute(dto);
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: DeleteDTO = {
      id: req.params.id,
      requestedBy: req.user?.id ?? '',
    };
    try {
      const result = await this.executeUseCase(dto);
      return this.handleDeleteOrRestore(res, result, 'Deleted successfully');
    } catch (err) {
      return this.fail(res, err);
    }
  }
}
