import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import { DateTimeObject } from '../../../Core/domain/dateTimeObject';
import { DeleteDTO } from '../../../../core/DTO/deleteDTO';
import { WalletType } from '../../domain/walletType';
import { WalletTypeMap } from '../../mappers/walletTypeMap';
import {
  WalletTypeDTO,
  CreateWalletTypeDTO,
  UpdateWalletTypeDTO,
} from '../../DTO/walletTypeDTO';
import { IWalletTypeRepo } from '../../repos/interface/IWalletTypeRepo';
import { IBalanceTypeRepo } from '../../repos/interface/IBalanceTypeRepo';
import { WalletResponse } from '../shared/response';

export class CreateWalletTypeUseCase
  implements UseCase<CreateWalletTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IWalletTypeRepo,
    private readonly balanceTypeRepo: IBalanceTypeRepo,
  ) {}

  async execute(dto: CreateWalletTypeDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findByName((dto.name ?? '').trim());
      if (existing) {
        return left(
          new BaseErrors.AlreadyExistError(
            `Wallet type "${dto.name}" already exists`,
          ),
        );
      }

      // A missing id falls through to the domain guard (ValidationError); a
      // supplied one must point at a live balance type.
      if (
        dto.balanceTypeId &&
        !(await this.balanceTypeRepo.exists(dto.balanceTypeId))
      ) {
        return left(new BaseErrors.NotFoundError('Balance type not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const orError = WalletType.create({
        name: dto.name,
        description: dto.description,
        category: dto.category,
        balanceTypeId: dto.balanceTypeId,
        overdraftAllowed: dto.overdraftAllowed ?? false,
        overdraftLimit: dto.overdraftLimit,
        allowTransfersOut: dto.allowTransfersOut ?? false,
        allowWithdrawals: dto.allowWithdrawals ?? false,
        requiredKycLevel: dto.requiredKycLevel ?? 0,
        glAccountCode: dto.glAccountCode,
        isActive: dto.isActive ?? true,
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
        return left(new BaseErrors.GenericError('Failed to create wallet type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class UpdateWalletTypeUseCase
  implements UseCase<UpdateWalletTypeDTO, Promise<WalletResponse<string>>>
{
  constructor(
    private readonly repo: IWalletTypeRepo,
    private readonly balanceTypeRepo: IBalanceTypeRepo,
  ) {}

  async execute(dto: UpdateWalletTypeDTO): Promise<WalletResponse<string>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Wallet type not found'));
      }

      if (
        dto.balanceTypeId &&
        !(await this.balanceTypeRepo.exists(dto.balanceTypeId))
      ) {
        return left(new BaseErrors.NotFoundError('Balance type not found'));
      }

      const now = DateTimeObject.create(-1).getValue();
      const rebuilt = WalletType.create(
        {
          name: dto.name ?? existing.name,
          description: dto.description ?? existing.description,
          category: dto.category ?? existing.category,
          balanceTypeId: dto.balanceTypeId ?? existing.balanceTypeId,
          overdraftAllowed: dto.overdraftAllowed ?? existing.overdraftAllowed,
          overdraftLimit: dto.overdraftLimit ?? existing.overdraftLimit,
          allowTransfersOut: dto.allowTransfersOut ?? existing.allowTransfersOut,
          allowWithdrawals: dto.allowWithdrawals ?? existing.allowWithdrawals,
          requiredKycLevel: dto.requiredKycLevel ?? existing.requiredKycLevel,
          glAccountCode: dto.glAccountCode ?? existing.glAccountCode,
          isActive: dto.isActive ?? existing.isActive,
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
        return left(new BaseErrors.GenericError('Failed to update wallet type'));
      }
      return right(Result.ok<string>(saved));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class DeleteWalletTypeUseCase
  implements UseCase<DeleteDTO, Promise<WalletResponse<void>>>
{
  constructor(private readonly repo: IWalletTypeRepo) {}

  async execute(dto: DeleteDTO): Promise<WalletResponse<void>> {
    try {
      const existing = await this.repo.findById(dto.id);
      if (!existing) {
        return left(new BaseErrors.NotFoundError('Wallet type not found'));
      }

      // FR-WT-4: a wallet type in use cannot be deleted.
      const inUse = await this.repo.countWalletsByType(dto.id);
      if (inUse > 0) {
        return left(
          new BaseErrors.BusinessRuleError(
            'This wallet type is in use by one or more wallets and cannot be deleted',
          ),
        );
      }

      const deleted = await this.repo.delete(dto);
      if (!deleted) {
        return left(new BaseErrors.GenericError('Failed to delete wallet type'));
      }
      return right(Result.ok<void>());
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}

export class ListWalletTypeUseCase
  implements UseCase<void, Promise<WalletResponse<WalletTypeDTO[]>>>
{
  constructor(private readonly repo: IWalletTypeRepo) {}

  async execute(): Promise<WalletResponse<WalletTypeDTO[]>> {
    try {
      const items = await this.repo.list();
      return right(Result.ok<WalletTypeDTO[]>(items.map(WalletTypeMap.toDTO)));
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
