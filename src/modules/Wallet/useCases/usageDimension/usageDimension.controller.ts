import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateUsageDimensionUseCase,
  UpdateUsageDimensionUseCase,
  DeleteUsageDimensionUseCase,
  ListUsageDimensionUseCase,
} from './usageDimension.use-cases';
import {
  CreateUsageDimensionDTO,
  UpdateUsageDimensionDTO,
} from '../../DTO/usageDimensionDTO';

export class CreateUsageDimensionController extends BaseController {
  constructor(private readonly useCase: CreateUsageDimensionUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateUsageDimensionDTO = {
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

export class UpdateUsageDimensionController extends BaseController {
  constructor(private readonly useCase: UpdateUsageDimensionUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateUsageDimensionDTO = {
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

export class DeleteUsageDimensionController extends BaseController {
  constructor(private readonly useCase: DeleteUsageDimensionUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'Usage dimension deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListUsageDimensionController extends BaseController {
  constructor(private readonly useCase: ListUsageDimensionUseCase) {
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
