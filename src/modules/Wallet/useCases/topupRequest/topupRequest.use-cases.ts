import * as grpc from '@grpc/grpc-js';
import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { UniqueEntityID } from '../../../../core/domain/UniqueEntityID';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { uploadRejection, sanitizeFilename } from '../../../../core/utils/fileValidation';
import { IObjectStorage } from '../../../../infra/storage/types';
import {
  IWorkflowIntegration,
  WorkflowEngineError,
} from '../../../../infra/workflow';
import { config } from '../../../../config';
import {
  TopupRequest,
  TopupRequestState,
  TOPUP_MAX_ATTACHMENTS,
  TOPUP_REQUEST_STATES,
  TOPUP_DEPOSIT_METHODS,
  TopupDepositMethod,
  creditFromDeposit,
} from '../../domain/topupRequest';
import { TopupRequestAttachment } from '../../domain/topupRequestAttachment';
import { TopupRequestMap } from '../../mappers/topupRequestMap';
import { TopupRequestAttachmentMap } from '../../mappers/topupRequestAttachmentMap';
import {
  CreateTopupRequestDTO,
  UploadTopupAttachmentDTO,
  TopupAttachmentRefDTO,
  TopupRequestActionDTO,
  ReviewTopupRequestDTO,
  ListTopupRequestsDTO,
  TopupRequestDTO,
  TopupRequestAttachmentDTO,
  TopupRequestPageDTO,
  TopupBankAccountDTO,
  TopupFundingOptionsDTO,
  TopupAttachmentContent,
  TopupTransitionsDTO,
} from '../../DTO/topupRequestDTO';
import { ITopupRequestRepo } from '../../repos/interface/ITopupRequestRepo';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import { IUnitRegistry } from '../../services/unitRegistry.service';
import { IWalletTypeRepo } from '../../repos/interface/IWalletTypeRepo';
import {
  ITopupConfigService,
  TopupConfigUnavailableError,
} from '../../services/topupConfig.service';
import {
  IConversionService,
  ConversionUnavailableError,
} from '../../services/conversion.service';
import {
  CollectionAccountsUnavailableError,
  ICollectionAccountDirectory,
} from '../../services/collectionAccounts.service';
import { TopupRequestAccess } from '../../services/topupRequestAccess.service';
import { OwnershipUnavailableError } from '../../services/walletOwnership.service';
import {
  TOPUP_REQUEST_ENTITY,
  TOPUP_STATUS_SLUGS,
} from '../../infra/workflow/registerEntities';
import { toWalletWorkflowError } from '../shared/workflowError';
import { WalletResponse } from '../shared/response';
import { CreditWalletUseCase } from '../walletTransaction/walletTransaction.use-cases';
import { GlPostingService } from '../../services/glPosting.service';

const TOPUP_CODE_PREFIX = 'TUR';

/** Minutes, megabytes … are granted, never bought: no money value to convert to. */
function quantityOnly(unitCode: string): BaseErrors.AllErrors {
  return new BaseErrors.BusinessRuleError(
    `${unitCode} is a quantity-only unit; it can't be topped up with money`,
  );
}
const BLOCKED_WALLET_STATUSES = new Set(['suspended', 'closed']);

function now(): DateTimeObject {
  return DateTimeObject.create(-1).getValue();
}

async function generateTopupCode(repo: ITopupRequestRepo): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    const code = `${TOPUP_CODE_PREFIX}${rand}`;
    if (!(await repo.findByCode(code))) return code;
  }
  throw new Error('Failed to generate a unique top-up request code');
}

/**
 * Failures that are not bugs: config/ownership lookups that could not be made.
 * Returned as errors the caller can read, instead of an opaque 500.
 */
function dependencyError(err: unknown): BaseErrors.AllErrors | null {
  if (err instanceof TopupConfigUnavailableError) {
    return new BaseErrors.BusinessRuleError(`Top-up is not available: ${err.message}`);
  }
  if (err instanceof ConversionUnavailableError) {
    return new BaseErrors.BusinessRuleError(`Top-up is not available: ${err.message}`);
  }
  if (err instanceof CollectionAccountsUnavailableError) {
    return new BaseErrors.BusinessRuleError(`Top-up is not available: ${err.message}`);
  }
  if (err instanceof OwnershipUnavailableError) {
    return new BaseErrors.GenericError('Wallet ownership cannot be verified right now');
  }
  if (err instanceof WorkflowEngineError) {
    return toWalletWorkflowError(err);
  }
  return null;
}

function unexpected(err: unknown) {
  return dependencyError(err) ?? new GenericAppError.UnexpectedError(err);
}

/** Not-found for both "missing" and "not yours", so ids can't be probed. */
const requestNotFound = () => new BaseErrors.NotFoundError('Top-up request not found');

/** The approval workflow must be wired before anything can be submitted. */
function workflowConfigured(): boolean {
  return (
    !!config.workflow.grpcTarget &&
    !!config.workflow.apiKey &&
    !!config.workflow.moduleId &&
    !!config.workflow.topupRequestTypeId
  );
}

// -----------------------------------------------------------------------------
// Bank accounts (what a depositor pays into)
// -----------------------------------------------------------------------------

/**
 * Funding options for one wallet: every currency that can be converted into
 * the wallet's unit, the accounts holding it, the rate fixed for the request
 * and that currency's deposit limits. Returned per wallet, because the rate
 * and the eligible currencies depend on the wallet's UOM.
 */
export class ListTopupBankAccountsUseCase
  implements UseCase<string, Promise<WalletResponse<TopupFundingOptionsDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly units: IUnitRegistry,
    private readonly walletTypeRepo: IWalletTypeRepo,
    private readonly topupConfig: ITopupConfigService,
    private readonly conversion: IConversionService,
    private readonly collectionAccounts: ICollectionAccountDirectory,
  ) {}

  async execute(walletId: string): Promise<WalletResponse<TopupFundingOptionsDTO>> {
    try {
      const wallet = await this.walletRepo.findById(walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));
      const unit = await this.units.resolve(wallet.unit);
      if (!unit) return left(new BaseErrors.NotFoundError('Wallet unit not found'));
      if (!unit.valued) return left(quantityOnly(unit.code));

      const walletType = await this.walletTypeRepo.findById(wallet.walletTypeId);
      if (!walletType?.allowTopup) {
        return left(
          new BaseErrors.BusinessRuleError('This wallet type cannot be topped up'),
        );
      }

      const rates = await this.conversion.ratesFor(unit, now().value);
      const byCurrency = await this.collectionAccounts.byCurrency();
      const accounts: TopupBankAccountDTO[] = [];
      for (const [currency, rate] of Object.entries(rates) as [string, number][]) {
        const limits = await this.depositLimits(currency);
        for (const a of byCurrency[currency] ?? []) {
          accounts.push({
            code: a.code,
            currency,
            channel: a.channel,
            bankName: a.institutionName,
            accountName: a.accountName,
            accountNo: a.accountNo,
            payerReference: a.payerReference,
            branch: a.branch,
            routingNo: a.routingNo,
            mfsAccountType: a.mfsAccountType,
            instructions: a.instructions,
            methods: a.acceptedMethods,
            rate,
            min: limits?.min,
            max: limits?.max,
          });
        }
      }
      return right(
        Result.ok<TopupFundingOptionsDTO>({
          walletId: wallet.id.toString(),
          unitCode: unit.code,
          decimals: unit.decimals,
          accounts,
        }),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }

  /** A currency with no configured limits still lists; the create call refuses it. */
  private async depositLimits(currency: string) {
    try {
      return await this.topupConfig.depositLimits(currency);
    } catch (err) {
      if (err instanceof TopupConfigUnavailableError) return undefined;
      if (err instanceof ConversionUnavailableError) return undefined;
      throw err;
    }
  }
}

// -----------------------------------------------------------------------------
// Owner: draft, attachments, submit, cancel
// -----------------------------------------------------------------------------

/**
 * Draft a bank-deposit top-up. The route decides who may: the wallet's owner
 * (`/my-wallets`, behind requireWalletOwner) or staff raising it on the
 * owner's behalf (`/wallets`, behind wallet.topup-request.create). Either way
 * nothing moves until a reviewer — never the one who raised it — approves.
 */
export class CreateTopupRequestUseCase
  implements UseCase<CreateTopupRequestDTO, Promise<WalletResponse<TopupRequestDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly walletRepo: IWalletRepo,
    private readonly units: IUnitRegistry,
    private readonly walletTypeRepo: IWalletTypeRepo,
    private readonly topupConfig: ITopupConfigService,
    private readonly conversion: IConversionService,
    private readonly collectionAccounts: ICollectionAccountDirectory,
  ) {}

  async execute(dto: CreateTopupRequestDTO): Promise<WalletResponse<TopupRequestDTO>> {
    try {
      const depositAmount = Number(dto.depositAmount);
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return left(
          new BaseErrors.ValidationError('depositAmount must be a number greater than 0'),
        );
      }
      const depositMethod = String(dto.depositMethod ?? '').toUpperCase() as TopupDepositMethod;
      if (!TOPUP_DEPOSIT_METHODS.includes(depositMethod)) {
        return left(
          new BaseErrors.ValidationError(
            `depositMethod must be one of ${TOPUP_DEPOSIT_METHODS.join(', ')}`,
          ),
        );
      }
      const depositDate = Number(dto.depositDate);
      if (!Number.isInteger(depositDate) || depositDate <= 0) {
        return left(new BaseErrors.ValidationError('depositDate must be unix seconds'));
      }
      const bankAccountCode = String(dto.bankAccountCode ?? '').trim();
      const depositReference = String(dto.depositReference ?? '').trim();
      if (!bankAccountCode || !depositReference) {
        return left(
          new BaseErrors.ValidationError('bankAccountCode and depositReference are required'),
        );
      }

      const wallet = await this.walletRepo.findById(dto.walletId);
      if (!wallet) return left(new BaseErrors.NotFoundError('Wallet not found'));
      if (BLOCKED_WALLET_STATUSES.has((wallet.status ?? '').trim().toLowerCase())) {
        return left(
          new BaseErrors.BusinessRuleError(`Wallet is ${wallet.status}; it cannot be topped up`),
        );
      }
      const unit = await this.units.resolve(wallet.unit);
      if (!unit) return left(new BaseErrors.NotFoundError('Wallet unit not found'));
      if (!unit.valued) return left(quantityOnly(unit.code));

      const walletType = await this.walletTypeRepo.findById(wallet.walletTypeId);
      if (!walletType?.allowTopup) {
        return left(
          new BaseErrors.BusinessRuleError('This wallet type cannot be topped up'),
        );
      }

      // The account decides the currency — the client never names it, so the
      // slip currency and the account it was paid into cannot disagree.
      const byCurrency = await this.collectionAccounts.byCurrency();
      let depositCurrency: string | undefined;
      let account;
      for (const [currency, accounts] of Object.entries(byCurrency)) {
        const found = accounts.find((a) => a.code === bankAccountCode);
        if (found) {
          depositCurrency = currency;
          account = found;
          break;
        }
      }
      if (!account || !depositCurrency) {
        return left(
          new BaseErrors.ValidationError(`Unknown bank account '${bankAccountCode}'`),
        );
      }
      if (account.acceptedMethods.length && !account.acceptedMethods.includes(depositMethod)) {
        return left(
          new BaseErrors.ValidationError(
            `${account.institutionName} (${account.code}) does not accept ${depositMethod} deposits`,
          ),
        );
      }

      // Rate is read once and stored, so approval credits what was quoted.
      const at0 = now();
      const { rate } = await this.conversion.rateFor(unit, depositCurrency, at0.value);
      // Rounded down to what the unit can hold (whole units when decimals = 0).
      const amount = creditFromDeposit(depositAmount, rate, unit.decimals);

      const bankDeposit = await this.topupConfig.depositLimits(depositCurrency);
      if (depositAmount < bankDeposit.min || depositAmount > bankDeposit.max) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Deposit must be between ${bankDeposit.min} and ${bankDeposit.max} ${depositCurrency}`,
          ),
        );
      }

      // One slip, one top-up: the same reference into the same account can't
      // be claimed twice while an earlier request is still alive.
      if (await this.repo.existsLiveDeposit(bankAccountCode, depositReference)) {
        return left(
          new BaseErrors.ConflictError(
            'A top-up request for this deposit reference already exists',
          ),
        );
      }

      const at = at0;
      const requestOrError = TopupRequest.create(
        {
          code: await generateTopupCode(this.repo),
          walletId: wallet.id.toString(),
          channel: 'BANK_DEPOSIT',
          amount,
          unitCategoryId: wallet.unitCategoryId,
          unitId: wallet.unitId,
          unitCode: wallet.unitCode,
          depositCurrency,
          depositAmount,
          depositMethod,
          rate,
          requestedBy: dto.requestedBy,
          bankAccountCode,
          depositReference,
          depositDate: DateTimeObject.create(depositDate).getValue(),
          depositorName: dto.depositorName?.trim() || undefined,
          note: dto.note?.trim() || undefined,
          state: 'DRAFT',
          createdBy: dto.requestedBy,
          updatedBy: dto.requestedBy,
          createdAt: at,
          updatedAt: at,
        },
        undefined,
        at,
      );
      if (requestOrError.isFailure) {
        return left(new BaseErrors.ValidationError(String(requestOrError.error)));
      }
      const request = requestOrError.getValue();
      await this.repo.create(request);
      return right(Result.ok<TopupRequestDTO>(TopupRequestMap.toDTO(request, [])));
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

export class UploadTopupAttachmentUseCase
  implements
    UseCase<UploadTopupAttachmentDTO, Promise<WalletResponse<TopupRequestAttachmentDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
    private readonly storage: IObjectStorage,
  ) {}

  async execute(
    dto: UploadTopupAttachmentDTO,
  ): Promise<WalletResponse<TopupRequestAttachmentDTO>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canAct(dto.actor, request))) {
        return left(requestNotFound());
      }
      if (!request.isEditable) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Attachments can only be changed on a draft (state is ${request.state})`,
          ),
        );
      }
      if ((await this.repo.countAttachments(request.id.toString())) >= TOPUP_MAX_ATTACHMENTS) {
        return left(
          new BaseErrors.BusinessRuleError(
            `A top-up request can have at most ${TOPUP_MAX_ATTACHMENTS} attachments`,
          ),
        );
      }

      const rejection = uploadRejection({
        body: dto.file?.buffer,
        contentType: dto.file?.mimetype,
        allowedContentTypes: config.storage.allowedContentTypes,
        maxBytes: config.storage.maxFileBytes,
      });
      if (rejection || !dto.file) {
        return left(new BaseErrors.ValidationError(rejection ?? 'file is required'));
      }

      const requestId = request.id.toString();
      const attachmentId = new UniqueEntityID();
      const safeName = sanitizeFilename(dto.file.originalname ?? 'file');
      const stored = await this.storage.put({
        key: `topup-requests/${requestId}/${attachmentId.toString()}-${safeName}`,
        body: dto.file.buffer,
        contentType: dto.file.mimetype.trim().toLowerCase(),
      });

      const actorId = dto.actor?.id ?? '';
      const at = now();
      const attachmentOrError = TopupRequestAttachment.create(
        {
          topupRequestId: requestId,
          originalFilename: safeName,
          storageDriver: stored.driver,
          storageKey: stored.key,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: at,
          updatedAt: at,
        },
        attachmentId,
      );
      if (attachmentOrError.isFailure) {
        await this.discard(stored.key);
        return left(new BaseErrors.ValidationError(String(attachmentOrError.error)));
      }

      try {
        await this.repo.addAttachment(attachmentOrError.getValue());
      } catch (err) {
        // The bytes are orphaned without their row — remove them.
        await this.discard(stored.key);
        throw err;
      }
      return right(
        Result.ok<TopupRequestAttachmentDTO>(
          TopupRequestAttachmentMap.toDTO(attachmentOrError.getValue()),
        ),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (err) {
      console.error(`[topup] failed to remove orphaned upload '${key}':`, err);
    }
  }
}

export class DeleteTopupAttachmentUseCase
  implements UseCase<TopupAttachmentRefDTO, Promise<WalletResponse<void>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
  ) {}

  async execute(dto: TopupAttachmentRefDTO): Promise<WalletResponse<void>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canAct(dto.actor, request))) {
        return left(requestNotFound());
      }
      if (!request.isEditable) {
        return left(
          new BaseErrors.BusinessRuleError(
            `Attachments can only be changed on a draft (state is ${request.state})`,
          ),
        );
      }
      // Soft delete: the stored object stays, so the audit trail of what was
      // once uploaded survives.
      const deleted = await this.repo.deleteAttachment(
        dto.topupRequestId,
        dto.attachmentId,
        dto.actor?.id ?? '',
      );
      if (!deleted) return left(new BaseErrors.NotFoundError('Attachment not found'));
      return right(Result.ok<void>());
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

/**
 * DRAFT → SUBMITTED, starting the approval workflow.
 *
 * The engine is called FIRST: if it fails the request simply stays a draft and
 * the owner retries. The engine's Initiate is not idempotent (a second call for
 * the same entity is ALREADY_EXISTS), so a retry after a half-finished submit
 * reads the existing instance's status instead of failing.
 */
export class SubmitTopupRequestUseCase
  implements UseCase<TopupRequestActionDTO, Promise<WalletResponse<TopupRequestDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
    private readonly workflow: IWorkflowIntegration,
  ) {}

  async execute(dto: TopupRequestActionDTO): Promise<WalletResponse<TopupRequestDTO>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canAct(dto.actor, request))) {
        return left(requestNotFound());
      }
      const requestId = request.id.toString();
      const actorId = dto.actor?.id ?? '';

      const at = now();
      const submitted = request.submit(actorId, at);
      if (submitted.isFailure) {
        return left(new BaseErrors.BusinessRuleError(String(submitted.error)));
      }
      if ((await this.repo.countAttachments(requestId)) === 0) {
        return left(
          new BaseErrors.BusinessRuleError('Attach the deposit slip before submitting'),
        );
      }
      if (
        await this.repo.existsLiveDeposit(
          request.bankAccountCode,
          request.depositReference,
          requestId,
        )
      ) {
        return left(
          new BaseErrors.ConflictError(
            'A top-up request for this deposit reference already exists',
          ),
        );
      }
      if (!workflowConfigured()) {
        return left(
          new BaseErrors.BusinessRuleError(
            'Top-up approval workflow is not configured; requests cannot be submitted',
          ),
        );
      }

      const roleIds = dto.actor?.roles ?? [];
      let status: { statusId: string; statusName?: string; statusColor?: string };
      try {
        const initiated = await this.workflow.initiate(TOPUP_REQUEST_ENTITY, {
          entityId: requestId,
          requestedBy: actorId,
          roleIds,
          metadata: { code: request.code, amount: request.amount, walletId: request.walletId },
        });
        status = {
          statusId: initiated.statusId,
          statusName: initiated.statusName,
          statusColor: initiated.statusColor ?? undefined,
        };
      } catch (err) {
        if (!(err instanceof WorkflowEngineError) || err.grpcCode !== grpc.status.ALREADY_EXISTS) {
          throw err;
        }
        const current = await this.workflow.allowedTransitions(TOPUP_REQUEST_ENTITY, {
          entityId: requestId,
          requestedBy: actorId,
          roleIds,
        });
        status = {
          statusId: current.currentStatusId,
          statusName: current.currentStatusName,
          statusColor: current.currentStatusColor ?? undefined,
        };
      }

      request.applyWorkflowStatus({ ...status, statusClosed: false });
      if (!(await this.repo.saveTransition(request, 'DRAFT'))) {
        return left(
          new BaseErrors.ConflictError('The request changed while submitting; reload and retry'),
        );
      }
      return right(Result.ok<TopupRequestDTO>(TopupRequestMap.toDTO(request)));
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

/**
 * Owner withdraws a request. A draft is cancelled locally; a submitted request
 * also moves its workflow instance to `cancelled`, which the engine only allows
 * while its rules permit (e.g. before a reviewer picked it up).
 */
export class CancelTopupRequestUseCase
  implements UseCase<TopupRequestActionDTO, Promise<WalletResponse<TopupRequestDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
    private readonly workflow: IWorkflowIntegration,
  ) {}

  async execute(dto: TopupRequestActionDTO): Promise<WalletResponse<TopupRequestDTO>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canAct(dto.actor, request))) {
        return left(requestNotFound());
      }
      const expected: TopupRequestState = request.state;
      const actorId = dto.actor?.id ?? '';
      const cancelled = request.cancel(actorId, now());
      if (cancelled.isFailure) {
        return left(new BaseErrors.BusinessRuleError(String(cancelled.error)));
      }

      if (expected === 'SUBMITTED') {
        const requestId = request.id.toString();
        const roleIds = dto.actor?.roles ?? [];
        const allowed = await this.workflow.allowedTransitions(TOPUP_REQUEST_ENTITY, {
          entityId: requestId,
          requestedBy: actorId,
          roleIds,
        });
        const target = allowed.transitions.find(
          (t) => t.toStatusSlug === TOPUP_STATUS_SLUGS.cancelled,
        );
        if (!target) {
          return left(
            new BaseErrors.BusinessRuleError(
              'This request can no longer be cancelled; it is already being reviewed',
            ),
          );
        }
        const moved = await this.workflow.executeTransition(TOPUP_REQUEST_ENTITY, {
          entityId: requestId,
          fromStatusId: allowed.currentStatusId,
          toStatusId: target.toStatusId,
          requestedBy: actorId,
          roleIds,
          note: 'Cancelled by requester',
        });
        request.applyWorkflowStatus({
          statusId: moved.toStatusId,
          statusName: moved.toStatusName,
          statusColor: moved.toStatusColor ?? undefined,
          statusClosed: moved.closed,
        });
      }

      if (!(await this.repo.saveTransition(request, expected))) {
        return left(
          new BaseErrors.ConflictError('The request changed while cancelling; reload and retry'),
        );
      }
      return right(Result.ok<TopupRequestDTO>(TopupRequestMap.toDTO(request)));
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

// -----------------------------------------------------------------------------
// Reads (owner or reviewer)
// -----------------------------------------------------------------------------

export class GetTopupRequestUseCase
  implements UseCase<TopupRequestActionDTO, Promise<WalletResponse<TopupRequestDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
  ) {}

  async execute(dto: TopupRequestActionDTO): Promise<WalletResponse<TopupRequestDTO>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canView(dto.actor, request))) {
        return left(requestNotFound());
      }
      const attachments = await this.repo.listAttachments(request.id.toString());
      return right(
        Result.ok<TopupRequestDTO>(
          TopupRequestMap.toDTO(request, attachments.map(TopupRequestAttachmentMap.toDTO)),
        ),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

/**
 * Paged list. The route decides the audience: the owner route pins `walletId`
 * (after requireWalletOwner), the reviewer route may filter freely.
 */
export class ListTopupRequestsUseCase
  implements UseCase<ListTopupRequestsDTO, Promise<WalletResponse<TopupRequestPageDTO>>>
{
  constructor(private readonly repo: ITopupRequestRepo) {}

  async execute(dto: ListTopupRequestsDTO): Promise<WalletResponse<TopupRequestPageDTO>> {
    try {
      if (dto.state && !TOPUP_REQUEST_STATES.includes(dto.state)) {
        return left(
          new BaseErrors.ValidationError(`state must be one of ${TOPUP_REQUEST_STATES.join(', ')}`),
        );
      }
      const limit = dto.limit ?? 50;
      const offset = dto.offset ?? 0;
      const page = await this.repo.list({
        walletId: dto.walletId,
        state: dto.state,
        createdFrom: dto.createdFrom,
        createdTo: dto.createdTo,
        limit,
        offset,
      });
      return right(
        Result.ok<TopupRequestPageDTO>({
          items: page.items.map((r) => TopupRequestMap.toDTO(r)),
          total: page.total,
          limit: Math.min(Math.max(limit, 1), 200),
          offset: Math.max(offset, 0),
        }),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

export class DownloadTopupAttachmentUseCase
  implements UseCase<TopupAttachmentRefDTO, Promise<WalletResponse<TopupAttachmentContent>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
    private readonly storage: IObjectStorage,
  ) {}

  async execute(dto: TopupAttachmentRefDTO): Promise<WalletResponse<TopupAttachmentContent>> {
    try {
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request || !(await this.access.canDownloadAttachments(dto.actor, request))) {
        return left(requestNotFound());
      }
      const attachment = await this.repo.findAttachment(dto.topupRequestId, dto.attachmentId);
      if (!attachment) return left(new BaseErrors.NotFoundError('Attachment not found'));

      const object = await this.storage.get(attachment.storageKey);
      return right(
        Result.ok<TopupAttachmentContent>({
          stream: object.stream,
          filename: attachment.originalFilename,
          // The row is authoritative: it was checked at upload time.
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        }),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

// -----------------------------------------------------------------------------
// Reviewer
// -----------------------------------------------------------------------------

export class ListTopupTransitionsUseCase
  implements UseCase<TopupRequestActionDTO, Promise<WalletResponse<TopupTransitionsDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly workflow: IWorkflowIntegration,
  ) {}

  async execute(dto: TopupRequestActionDTO): Promise<WalletResponse<TopupTransitionsDTO>> {
    try {
      if (!(await this.repo.exists(dto.topupRequestId))) return left(requestNotFound());
      const allowed = await this.workflow.allowedTransitions(TOPUP_REQUEST_ENTITY, {
        entityId: dto.topupRequestId,
        requestedBy: dto.actor?.id ?? '',
        roleIds: dto.actor?.roles ?? [],
      });
      return right(
        Result.ok<TopupTransitionsDTO>({
          currentStatusId: allowed.currentStatusId,
          currentStatusName: allowed.currentStatusName,
          isClosed: allowed.isClosed,
          transitions: allowed.transitions.map((t) => ({
            toStatusId: t.toStatusId,
            toStatusName: t.toStatusName,
            toStatusSlug: t.toStatusSlug,
          })),
        }),
      );
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

/**
 * Approve or reject a submitted request.
 *
 * Domain rules run first (state, maker-checker, reject needs a note) so a bad
 * review never reaches the engine. The engine's allowed-transition list for
 * the reviewer's roles is the authorization check for the move itself. The
 * wallet owner may never review — even with the permission, e.g. a staff member
 * whose own organization owns the wallet.
 *
 * Approval does not credit inline: the engine's action rule on `approved`
 * dispatches `credit-wallet-topup` (CreditTopupRequestUseCase).
 */
export class ReviewTopupRequestUseCase
  implements UseCase<ReviewTopupRequestDTO, Promise<WalletResponse<TopupRequestDTO>>>
{
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly access: TopupRequestAccess,
    private readonly workflow: IWorkflowIntegration,
  ) {}

  async execute(dto: ReviewTopupRequestDTO): Promise<WalletResponse<TopupRequestDTO>> {
    try {
      if (dto.decision !== 'approve' && dto.decision !== 'reject') {
        return left(new BaseErrors.ValidationError('decision must be "approve" or "reject"'));
      }
      const request = await this.repo.findById(dto.topupRequestId);
      if (!request) return left(requestNotFound());

      const actorId = dto.actor?.id ?? '';
      const reviewed = request.review(dto.decision, actorId, dto.note, now());
      if (reviewed.isFailure) {
        return left(new BaseErrors.BusinessRuleError(String(reviewed.error)));
      }
      if (await this.access.isOwner(dto.actor, request)) {
        return left(
          new BaseErrors.BusinessRuleError('You cannot review a top-up for a wallet you own'),
        );
      }

      const requestId = request.id.toString();
      const roleIds = dto.actor?.roles ?? [];
      const allowed = await this.workflow.allowedTransitions(TOPUP_REQUEST_ENTITY, {
        entityId: requestId,
        requestedBy: actorId,
        roleIds,
      });
      const slug =
        dto.decision === 'approve' ? TOPUP_STATUS_SLUGS.approved : TOPUP_STATUS_SLUGS.rejected;
      const target = allowed.transitions.find((t) => t.toStatusSlug === slug);
      if (!target) {
        return left(
          new BaseErrors.NotAuthorizedError(
            `You cannot ${dto.decision} this request from its current status`,
          ),
        );
      }

      const moved = await this.workflow.executeTransition(TOPUP_REQUEST_ENTITY, {
        entityId: requestId,
        fromStatusId: allowed.currentStatusId,
        toStatusId: target.toStatusId,
        requestedBy: actorId,
        roleIds,
        ...(request.decisionNote ? { note: request.decisionNote } : {}),
      });
      request.applyWorkflowStatus({
        statusId: moved.toStatusId,
        statusName: moved.toStatusName,
        statusColor: moved.toStatusColor ?? undefined,
        statusClosed: moved.closed,
      });

      if (!(await this.repo.saveTransition(request, 'SUBMITTED'))) {
        // The engine committed but the row moved underneath us (e.g. the owner
        // cancelled in the same instant). Surface it; ops reconcile from the
        // engine log.
        console.error(
          `[topup] review of ${request.code} committed in the engine but the local row changed`,
        );
        return left(
          new BaseErrors.ConflictError('The request changed during review; reload and check its status'),
        );
      }
      return right(Result.ok<TopupRequestDTO>(TopupRequestMap.toDTO(request)));
    } catch (err) {
      return left(unexpected(err));
    }
  }
}

// -----------------------------------------------------------------------------
// Engine action: credit an approved request
// -----------------------------------------------------------------------------

/** The request can never be credited; the engine must stop retrying. */
export class PermanentTopupCreditFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentTopupCreditFailure';
  }
}

export interface CreditTopupResult {
  walletTransactionId: string;
  /** False when this call found the request already credited. */
  creditedNow: boolean;
}

/**
 * Runs from the engine's `credit-wallet-topup` action — at-least-once, so it is
 * idempotent end to end:
 *   - the wallet credit uses idempotency key `topup:<id>`, so a retry returns
 *     the original transaction instead of crediting twice;
 *   - the request moves APPROVED → CREDITED by compare-and-set.
 * A crash between the two is healed by the engine's retry.
 *
 * Throws PermanentTopupCreditFailure for requests that can never be credited;
 * any other throw is retryable. A request still SUBMITTED is retryable: the
 * engine dispatches the action as soon as it commits `approved`, which can be
 * before the review use case has saved APPROVED locally.
 */
export class CreditTopupRequestUseCase {
  constructor(
    private readonly repo: ITopupRequestRepo,
    private readonly creditWallet: CreditWalletUseCase,
    private readonly gl?: Pick<GlPostingService, 'tryPostForTransaction'>,
  ) {}

  async execute(topupRequestId: string): Promise<CreditTopupResult> {
    const result = await this.credit(topupRequestId);
    // After the credit is durable. Never fails the action: an unposted voucher
    // is picked up by the GL reconciler.
    await this.gl?.tryPostForTransaction(result.walletTransactionId);
    return result;
  }

  private async credit(topupRequestId: string): Promise<CreditTopupResult> {
    const request = await this.repo.findById(topupRequestId);
    if (!request) {
      throw new PermanentTopupCreditFailure(`Top-up request ${topupRequestId} not found`);
    }
    if (request.state === 'CREDITED' && request.walletTransactionId) {
      return { walletTransactionId: request.walletTransactionId, creditedNow: false };
    }
    if (request.state === 'SUBMITTED') {
      throw new Error(
        `Top-up request ${request.code} is not yet recorded as approved; retry later`,
      );
    }
    if (request.state !== 'APPROVED') {
      throw new PermanentTopupCreditFailure(
        `Top-up request ${request.code} is ${request.state}; only an approved request is credited`,
      );
    }

    const system = request.reviewedBy ?? 'system';
    const credited = await this.creditWallet.execute({
      walletId: request.walletId,
      amount: request.amount,
      description: `Bank deposit top-up ${request.code} (ref ${request.depositReference})`,
      idempotencyKey: `topup:${request.id.toString()}`,
      sourceType: 'BANK_DEPOSIT',
      sourceRef: `TUR:${request.code}`,
      requestedBy: system,
    });
    if (credited.isLeft()) {
      const error = credited.value;
      const message = (error as any)?.errorValue?.()?.message ?? 'wallet credit failed';
      // A missing or blocked wallet won't fix itself on retry: park it for a human.
      if (
        error instanceof BaseErrors.NotFoundError ||
        error instanceof BaseErrors.BusinessRuleError ||
        error instanceof BaseErrors.ValidationError
      ) {
        throw new PermanentTopupCreditFailure(`Cannot credit ${request.code}: ${message}`);
      }
      throw new Error(`Crediting ${request.code} failed: ${message}`);
    }
    const walletTransactionId = credited.value.getValue();

    const marked = request.markCredited(walletTransactionId, system, now());
    if (marked.isFailure) {
      throw new PermanentTopupCreditFailure(String(marked.error));
    }
    if (!(await this.repo.saveTransition(request, 'APPROVED'))) {
      const latest = await this.repo.findById(topupRequestId);
      if (latest?.state === 'CREDITED') {
        return { walletTransactionId, creditedNow: false };
      }
      throw new Error(`Top-up request ${request.code} changed while crediting; retry`);
    }
    return { walletTransactionId, creditedNow: true };
  }
}

