import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateWalletTypeUseCase,
  UpdateWalletTypeUseCase,
  DeleteWalletTypeUseCase,
  ListWalletTypeUseCase,
} from './walletType.use-cases';
import {
  CreateWalletTypeDTO,
  UpdateWalletTypeDTO,
} from '../../DTO/walletTypeDTO';

export class CreateWalletTypeController extends BaseController {
  constructor(private readonly useCase: CreateWalletTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateWalletTypeDTO = {
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

export class UpdateWalletTypeController extends BaseController {
  constructor(private readonly useCase: UpdateWalletTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateWalletTypeDTO = {
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

export class DeleteWalletTypeController extends BaseController {
  constructor(private readonly useCase: DeleteWalletTypeUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'Wallet type deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListWalletTypeController extends BaseController {
  constructor(private readonly useCase: ListWalletTypeUseCase) {
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
