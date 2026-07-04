import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  CreditWalletUseCase,
  DebitWalletUseCase,
  TransferUseCase,
  RecomputeWalletBalanceUseCase,
  ListWalletTransactionsUseCase,
  GetWalletTransactionUseCase,
} from './walletTransaction.use-cases';
import {
  CreditWalletDTO,
  DebitWalletDTO,
  TransferDTO,
} from '../../DTO/walletTransactionDTO';

export class CreditWalletController extends BaseController {
  constructor(private readonly useCase: CreditWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: CreditWalletDTO = {
      ...req.body,
      walletId: req.params.id,
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

export class DebitWalletController extends BaseController {
  constructor(private readonly useCase: DebitWalletUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: DebitWalletDTO = {
      ...req.body,
      walletId: req.params.id,
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

export class TransferController extends BaseController {
  constructor(private readonly useCase: TransferUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    const dto: TransferDTO = {
      ...req.body,
      fromWalletId: req.params.id,
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

export class RecomputeWalletBalanceController extends BaseController {
  constructor(private readonly useCase: RecomputeWalletBalanceUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        walletId: req.params.id,
        requestedBy: req.user?.id as string,
      });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ListWalletTransactionsController extends BaseController {
  constructor(private readonly useCase: ListWalletTransactionsUseCase) {
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

export class GetWalletTransactionController extends BaseController {
  constructor(private readonly useCase: GetWalletTransactionUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(req.params.txId);
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
