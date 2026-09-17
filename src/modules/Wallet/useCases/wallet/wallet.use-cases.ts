import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { Wallet, WALLET_DEFAULT_STATUS } from '../../domain/wallet';
import { WalletMap } from '../../mappers/walletMap';
import { WalletDTO, CreateWalletDTO, UpdateWalletDTO } from '../../DTO/walletDTO';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import { IWalletTypeRepo } from '../../repos/interface/IWalletTypeRepo';
import { IBalanceTypeRepo } from '../../repos/interface/IBalanceTypeRepo';
import { IUomRepo } from '../../repos/interface/IUomRepo';
import { IOwnerTypeRepo } from '../../repos/interface/IOwnerTypeRepo';
import { WalletResponse } from '../shared/response';

const WALLET_CODE_PREFIX = 'WAL';

/**
 * The initial workflow status the engine placed a new wallet at (FR-WF-1).
 * Returns null when the engine is not configured, so wallet creation still
 * works in dev/test without it (wallet stays at its local default status).
 */
export interface WalletWorkflowStatus {
  statusId: string;
  statusName: string;
  statusColor: string | null;
}

export interface WalletWorkflowInitiator {
  initiate(
    walletId: string,
    requestedBy: string,
    roleIds: string[],
  ): Promise<WalletWorkflowStatus | null>;
}

/** Generate a unique `WAL…` code, retrying on the rare collision. */
async function generateWalletCode(repo: IWalletRepo): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const code = `${WALLET_CODE_PREFIX}${rand}`;
    const clash = await repo.findByCode(code);
    if (!clash) return code;
  }
  throw new Error('Failed to generate a unique wallet code');
}

export class CreateWalletUseCase
  implements UseCase<CreateWalletDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IWalletRepo,
    private readonly walletTypeRepo: IWalletTypeRepo,
    private readonly balanceTypeRepo: IBalanceTypeRepo,
    private readonly uomRepo: IUomRepo,
    private readonly ownerTypeRepo: IOwnerTypeRepo,
    private readonly workflowInitiator?: WalletWorkflowInitiator,
  ) {}

  async execute(dto: CreateWalletDTO): Promise<WalletResponse<string>> {
    try {
      // Referential checks — the FKs must point at live rows.
      const walletType = await this.walletTypeRepo.findById(dto.walletTypeId);
      if (!walletType) {
        return left(new BaseErrors.NotFoundError('Wallet type not found'));
      }
      if (!(await this.uomRepo.exists(dto.uomId))) {
        return left(new BaseErrors.NotFoundError('UOM not found'));
      }

      // Not every UOM is meaningful for every balance type — the wallet type
      // supplies the balance type, which in turn constrains the UOM. An
      // untagged balance type is unrestricted.
      const uomAllowed = await this.balanceTypeRepo.isUomAllowed(
        walletType.balanceTypeId,
        dto.uomId,
      );
      if (!uomAllowed) {
        return left(
          new BaseErrors.BusinessRuleError(
            "This UOM is not allowed for the wallet type's balance type",
          ),
        );
      }
      if (!(await this.ownerTypeRepo.exists(dto.ownerTypeId))) {
        return left(new BaseErrors.NotFoundError('Owner type not found'));
      }
      if (
        dto.parentWalletId &&
        !(await this.repo.exists(dto.parentWalletId))
      ) {
        return left(new BaseErrors.NotFoundError('Parent wallet not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const code = await generateWalletCode(this.repo);
      const expiresAt =
        dto.expiresAt == null
          ? undefined
          : DateTimeObject.create(dto.expiresAt).getValue();

      const orError = Wallet.create({
        code,
        walletTypeId: dto.walletTypeId,
        uomId: dto.uomId,
        ownerTypeId: dto.ownerTypeId,
        ownerId: dto.ownerId,
        externalRef: dto.externalRef,
        parentWalletId: dto.parentWalletId,
        displayName: dto.displayName,
        balance: 0,
        heldAmount: 0,
        minBalance: dto.minBalance,
        maxBalance: dto.maxBalance,
        dailyDebitLimit: dto.dailyDebitLimit,
        monthlyDebitLimit: dto.monthlyDebitLimit,
        expiresAt,
        status: WALLET_DEFAULT_STATUS,
        createdBy: dto.requestedBy,
        updatedBy: dto.requestedBy,
        createdAt: now,
        updatedAt: now,
      });
      if (orError.isFailure) {
        return left(new BaseErrors.ValidationError(orError.error.toString()));
      }

      const saved = await this.repo.create(orError.getValue());
      if (!saved) {
        return left(new BaseErrors.GenericError('Failed to create wallet'));
      }

      // Initiate the wallet workflow (FR-WF-1) and project the engine's initial
      // status onto the denormalised cache. Best-effort: a not-yet-configured
      // engine returns null, and a transient engine failure must not undo a
      // committed wallet — the status stays at its local default until the
      // engine pushes a SyncEntityStatus later.
      if (this.workflowInitiator) {
        try {
          const status = await this.workflowInitiator.initiate(
            saved,
            dto.requestedBy,
            dto.roleIds ?? [],
          );
          if (status) {
            await this.repo.setWorkflowStatus(saved, {
              statusId: status.statusId,
              name: status.statusName,
              color: status.statusColor,
            });
          }
        } catch (wfErr) {
          console.error('[wallet] workflow initiate failed:', wfErr);
        }
      }

      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateWalletUseCase
  implements UseCase<UpdateWalletDTO, Promise<WalletResponse<string>>>
{
  constructor(private readonly repo: IWalletRepo) {}

  async execute(dto: UpdateWalletDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }

      if (dto.parentWalletId && dto.parentWalletId === dto.id) {
        return left(
          new BaseErrors.ValidationError('A wallet cannot be its own parent'),
        );
      }
      if (
        dto.parentWalletId &&
        !(await this.repo.exists(dto.parentWalletId))
      ) {
        return left(new BaseErrors.NotFoundError('Parent wallet not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const expiresAt =
        dto.expiresAt == null
          ? existing.expiresAt
          : DateTimeObject.create(dto.expiresAt).getValue();

      // Rebuild through create() so invariants re-run. Code, owner, type,
      // balance/held, and workflow status are immutable via this path.
      const rebuilt = Wallet.create(
        {
          code: existing.code,
          walletTypeId: existing.walletTypeId,
          uomId: existing.uomId,
          ownerTypeId: existing.ownerTypeId,
          ownerId: existing.ownerId,
          parentWalletId: dto.parentWalletId ?? existing.parentWalletId,
          displayName: dto.displayName ?? existing.displayName,
          balance: existing.balance,
          heldAmount: existing.heldAmount,
          minBalance: dto.minBalance ?? existing.minBalance,
          maxBalance: dto.maxBalance ?? existing.maxBalance,
          dailyDebitLimit: dto.dailyDebitLimit ?? existing.dailyDebitLimit,
          monthlyDebitLimit: dto.monthlyDebitLimit ?? existing.monthlyDebitLimit,
          expiresAt,
          status: existing.status,
          statusId: existing.statusId,
          statusName: existing.statusName,
          statusColor: existing.statusColor,
          voided: existing.voided,
          createdBy: existing.createdBy,
          createdAt: existing.createdAt,
          updatedBy: dto.requestedBy,
          updatedAt: now,
          deletedBy: existing.deletedBy,
          deletedAt: existing.deletedAt,
        },
        existing.id,
      );
      if (rebuilt.isFailure) {
        return left(new BaseErrors.ValidationError(rebuilt.error.toString()));
      }

      const saved = await this.repo.update(rebuilt.getValue());
      if (!saved) {
        return left(new BaseErrors.GenericError('Failed to update wallet'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteWalletUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IWalletRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }
      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(new BaseErrors.GenericError('Failed to delete wallet'));
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class GetWalletUseCase
  implements UseCase<string, Promise<WalletResponse<WalletDTO>>>
{
  constructor(private readonly repo: IWalletRepo) {}

  async execute(id: string): Promise<WalletResponse<WalletDTO>> {
    try {
      const existing = await this.repo.findById(id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Wallet not found'));
      }
      return right(Result.ok<WalletDTO>(WalletMap.toDTO(existing)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListWalletUseCase
  implements UseCase<void, Promise<WalletResponse<WalletDTO[]>>>
{
  constructor(private readonly repo: IWalletRepo) {}

  async execute(): Promise<WalletResponse<WalletDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(Result.ok<WalletDTO[]>(items.map(WalletMap.toDTO)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
