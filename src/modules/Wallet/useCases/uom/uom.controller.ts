import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateUomUseCase,
  UpdateUomUseCase,
  DeleteUomUseCase,
  ListUomUseCase,
} from './uom.use-cases';
import { CreateUomDTO, UpdateUomDTO } from '../../DTO/uomDTO';

export class CreateUomController extends BaseController {
  constructor(private readonly useCase: CreateUomUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateUomDTO = {
      ...req.body,
      requestedBy: req.user?.id,
    };
    try {
      const result = await this.useCase.execute(dto);
      if (result.isRight()) return this.created(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class UpdateUomController extends BaseController {
  constructor(private readonly useCase: UpdateUomUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateUomDTO = {
      ...req.body,
      id: req.params.id,
      requestedBy: req.user?.id,
    };
    try {
      const result = await this.useCase.execute(dto);
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class DeleteUomController extends BaseController {
  constructor(private readonly useCase: DeleteUomUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'UOM deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListUomController extends BaseController {
  constructor(private readonly useCase: ListUomUseCase) {
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
