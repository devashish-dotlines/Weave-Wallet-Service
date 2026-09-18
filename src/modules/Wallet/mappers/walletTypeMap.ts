import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { WalletType as WalletTypeModel } from '../../../infra/sequelize/models/Wallet/walletType';
import { WalletType, WalletCategory } from '../domain/walletType';
import { WalletTypeDTO } from '../DTO/walletTypeDTO';

export class WalletTypeMap extends Mapper<WalletType> {
  public static async toPersistence(
    w: WalletType,
  ): Promise<Partial<WalletTypeModel>> {
    return {
      id: w.id.toString(),
      name: w.name,
      description: w.description ?? null,
      category: w.category,
      balanceTypeId: w.balanceTypeId,
      overdraftAllowed: w.overdraftAllowed,
      overdraftLimit: w.overdraftLimit ?? null,
      allowTransfersOut: w.allowTransfersOut,
      allowTopup: w.allowTopup,
      allowWithdrawals: w.allowWithdrawals,
      requiredKycLevel: w.requiredKycLevel,
      glAccountCode: w.glAccountCode ?? null,
      isActive: w.isActive,
      voided: w.voided ?? false,
      createdBy: w.createdBy,
      createdAt: w.createdAt ? w.createdAt.value : 0,
      updatedBy: w.updatedBy,
      updatedAt: w.updatedAt ? w.updatedAt.value : 0,
      deletedBy: w.deletedBy ?? null,
      deletedAt: w.deletedAt ? w.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): WalletType | null {
    if (!raw) return null;
    const domainOrError = WalletType.create(
      {
        name: raw.name,
        description: raw.description ?? undefined,
        category: raw.category as WalletCategory,
        balanceTypeId: raw.balanceTypeId,
        overdraftAllowed: raw.overdraftAllowed,
        overdraftLimit:
          raw.overdraftLimit === null || raw.overdraftLimit === undefined
            ? undefined
            : Number(raw.overdraftLimit),
        allowTransfersOut: raw.allowTransfersOut,
        allowTopup: !!raw.allowTopup,
        allowWithdrawals: raw.allowWithdrawals,
        requiredKycLevel: Number(raw.requiredKycLevel),
        glAccountCode: raw.glAccountCode ?? undefined,
        isActive: raw.isActive,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'WalletType'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'WalletType'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('WalletTypeMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(w: WalletType): WalletTypeDTO {
    return {
      id: w.id.toString(),
      name: w.name,
      description: w.description,
      category: w.category,
      balanceTypeId: w.balanceTypeId,
      overdraftAllowed: w.overdraftAllowed,
      overdraftLimit: w.overdraftLimit,
      allowTransfersOut: w.allowTransfersOut,
      allowTopup: w.allowTopup,
      allowWithdrawals: w.allowWithdrawals,
      requiredKycLevel: w.requiredKycLevel,
      glAccountCode: w.glAccountCode,
      isActive: w.isActive,
    };
  }
}
