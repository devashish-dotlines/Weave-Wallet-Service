import * as express from 'express';
import { BaseController } from '../../../../core/infra/BaseController';
import {
  ListTopupBankAccountsUseCase,
  CreateTopupRequestUseCase,
  UploadTopupAttachmentUseCase,
  DeleteTopupAttachmentUseCase,
  SubmitTopupRequestUseCase,
  CancelTopupRequestUseCase,
  GetTopupRequestUseCase,
  ListTopupRequestsUseCase,
  DownloadTopupAttachmentUseCase,
  ListTopupTransitionsUseCase,
  ReviewTopupRequestUseCase,
} from './topupRequest.use-cases';
import { TopupRequestState } from '../../domain/topupRequest';
import { ListTopupRequestsDTO } from '../../DTO/topupRequestDTO';

function optionalInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function listFilter(query: any): ListTopupRequestsDTO {
  return {
    state: query.state ? (String(query.state).toUpperCase() as TopupRequestState) : undefined,
    createdFrom: optionalInt(query.createdFrom),
    createdTo: optionalInt(query.createdTo),
    limit: optionalInt(query.limit),
    offset: optionalInt(query.offset),
  };
}

/** Header-safe filename for Content-Disposition (names are sanitized at upload). */
function dispositionName(name: string): string {
  return name.replace(/["\\\r\n]/g, '_');
}

export class ListTopupBankAccountsController extends BaseController {
  constructor(private readonly useCase: ListTopupBankAccountsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute(String(req.params.walletId ?? ''));
      if (result.isRight()) return res.status(200).json(result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class CreateTopupRequestController extends BaseController {
  constructor(private readonly useCase: CreateTopupRequestUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const b = req.body ?? {};
      const result = await this.useCase.execute({
        walletId: req.params.walletId,
        depositAmount: b.depositAmount,
        depositMethod: b.depositMethod,
        bankAccountCode: b.bankAccountCode,
        depositReference: b.depositReference,
        depositDate: b.depositDate,
        depositorName: b.depositorName,
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

export class UploadTopupAttachmentController extends BaseController {
  constructor(private readonly useCase: UploadTopupAttachmentUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      const result = await this.useCase.execute({
        topupRequestId: req.params.id,
        file: file
          ? { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype }
          : undefined,
        actor: req.user,
      });
      if (result.isRight()) return this.created(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class DeleteTopupAttachmentController extends BaseController {
  constructor(private readonly useCase: DeleteTopupAttachmentUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        topupRequestId: req.params.id,
        attachmentId: req.params.attachmentId,
        actor: req.user,
      });
      if (result.isRight()) return res.sendStatus(204);
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

/** Submit / cancel / get / transitions share one shape: an action on `:id`. */
export class TopupRequestActionController extends BaseController {
  constructor(
    private readonly useCase:
      | SubmitTopupRequestUseCase
      | CancelTopupRequestUseCase
      | GetTopupRequestUseCase
      | ListTopupTransitionsUseCase,
  ) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        topupRequestId: req.params.id,
        actor: req.user,
      });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

/** Owner's list for one wallet (route runs requireWalletOwner first). */
export class ListWalletTopupRequestsController extends BaseController {
  constructor(private readonly useCase: ListTopupRequestsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        ...listFilter(req.query),
        walletId: req.params.walletId,
      });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

/** Reviewer's list across wallets. */
export class ListAllTopupRequestsController extends BaseController {
  constructor(private readonly useCase: ListTopupRequestsUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        ...listFilter(req.query),
        walletId: req.query.walletId ? String(req.query.walletId) : undefined,
      });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class ReviewTopupRequestController extends BaseController {
  constructor(private readonly useCase: ReviewTopupRequestUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        topupRequestId: req.params.id,
        decision: req.body?.decision,
        note: req.body?.note,
        actor: req.user,
      });
      if (result.isRight()) return this.ok(res, result.value.getValue());
      return this.handleUseCaseError(res, result.value);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}

export class DownloadTopupAttachmentController extends BaseController {
  constructor(private readonly useCase: DownloadTopupAttachmentUseCase) {
    super();
  }

  async executeImpl(req: express.Request, res: express.Response): Promise<any> {
    try {
      const result = await this.useCase.execute({
        topupRequestId: req.params.id,
        attachmentId: req.params.attachmentId,
        actor: req.user,
      });
      if (result.isLeft()) return this.handleUseCaseError(res, result.value);

      const doc = result.value.getValue();
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Length', String(doc.sizeBytes));
      // Always a download and never sniffed: user-uploaded files must not render
      // inline in a reviewer's browser under this service's origin.
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${dispositionName(doc.filename)}"`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      doc.stream.on('error', (err: Error) => {
        console.error('[topup] attachment stream failed:', err);
        res.destroy(err);
      });
      return doc.stream.pipe(res);
    } catch (err) {
      return this.fail(res, err as Error);
    }
  }
}
