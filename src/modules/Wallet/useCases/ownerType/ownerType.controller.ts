import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateOwnerTypeUseCase,
  UpdateOwnerTypeUseCase,
  DeleteOwnerTypeUseCase,
  ListOwnerTypeUseCase,
} from './ownerType.use-cases';
import {
  CreateOwnerTypeDTO,
  UpdateOwnerTypeDTO,
} from '../../DTO/ownerTypeDTO';

export class CreateOwnerTypeController extends BaseController {
  constructor(private readonly useCase: CreateOwnerTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateOwnerTypeDTO = {
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

export class UpdateOwnerTypeController extends BaseController {
  constructor(private readonly useCase: UpdateOwnerTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateOwnerTypeDTO = {
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

export class DeleteOwnerTypeController extends BaseController {
  constructor(private readonly useCase: DeleteOwnerTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'Owner type deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListOwnerTypeController extends BaseController {
  constructor(private readonly useCase: ListOwnerTypeUseCase) {
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
