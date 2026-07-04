import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreateWalletUseCase,
  UpdateWalletUseCase,
  DeleteWalletUseCase,
  GetWalletUseCase,
  ListWalletUseCase,
} from './wallet.use-cases';
import { CreateWalletDTO, UpdateWalletDTO } from '../../DTO/walletDTO';

export class CreateWalletController extends BaseController {
  constructor(private readonly useCase: CreateWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreateWalletDTO = {
      ...req.body,
      requestedBy: req.user?.id,
      roleIds: req.user?.roles ?? [],
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

export class UpdateWalletController extends BaseController {
  constructor(private readonly useCase: UpdateWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: UpdateWalletDTO = {
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

export class DeleteWalletController extends BaseController {
  constructor(private readonly useCase: DeleteWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id as string,
      });
      return this.handleDeleteOrRestore(res, result, 'Wallet deleted');
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class GetWalletController extends BaseController {
  constructor(private readonly useCase: GetWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(req.params.id);
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListWalletController extends BaseController {
  constructor(private readonly useCase: ListWalletUseCase) {
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
