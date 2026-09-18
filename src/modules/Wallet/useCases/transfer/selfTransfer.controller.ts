import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  LookupTransferRecipientUseCase,
  SelfTransferUseCase,
} from './selfTransfer.use-cases';

export class LookupTransferRecipientController extends BaseController {
  constructor(private readonly useCase: LookupTransferRecipientUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(String(req.query.code ?? ''));
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class SelfTransferController extends BaseController {
  constructor(private readonly useCase: SelfTransferUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const b = req.body ?? {};
      // Explicit fields only — nothing else from the body reaches the transfer.
      const result = await this.useCase.execute({
        fromWalletId: req.params.walletId,
        toWalletCode: b.toWalletCode,
        amount: b.amount,
        idempotencyKey: b.idempotencyKey,
        note: b.note,
        requestedBy: req.user?.id as string,
      });
      if (result.isRight()) return this.created(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
