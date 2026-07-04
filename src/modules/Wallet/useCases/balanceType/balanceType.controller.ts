import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateBalanceTypeUseCase,
  UpdateBalanceTypeUseCase,
  DeleteBalanceTypeUseCase,
  ListBalanceTypeUseCase,
} from './balanceType.use-cases';
import {
  CreateBalanceTypeDTO,
  UpdateBalanceTypeDTO,
} from '../../DTO/balanceTypeDTO';

export class CreateBalanceTypeController extends BaseController {
  constructor(private readonly useCase: CreateBalanceTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateBalanceTypeDTO = {
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

export class UpdateBalanceTypeController extends BaseController {
  constructor(private readonly useCase: UpdateBalanceTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateBalanceTypeDTO = {
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

export class DeleteBalanceTypeController extends BaseController {
  constructor(private readonly useCase: DeleteBalanceTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'Balance type deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListBalanceTypeController extends BaseController {
  constructor(private readonly useCase: ListBalanceTypeUseCase) {
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
