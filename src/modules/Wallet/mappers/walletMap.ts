import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { Wallet as WalletModel } from '../../../infra/sequelize/models/Wallet/wallet';
import { Wallet } from '../domain/wallet';
import { WalletDTO } from '../DTO/walletDTO';

export class WalletMap extends Mapper<Wallet> {
  public static async toPersistence(w: Wallet): Promise<Partial<WalletModel>> {
    return {
      id: w.id.toString(),
      code: w.code,
      walletTypeId: w.walletTypeId,
      balanceTypeId: w.balanceTypeId,
      uomId: w.uomId,
      ownerTypeId: w.ownerTypeId,
      ownerId: w.ownerId,
      parentWalletId: w.parentWalletId ?? null,
      displayName: w.displayName ?? null,
      balance: w.balance,
      heldAmount: w.heldAmount,
      minBalance: w.minBalance ?? null,
      maxBalance: w.maxBalance ?? null,
      dailyDebitLimit: w.dailyDebitLimit ?? null,
      monthlyDebitLimit: w.monthlyDebitLimit ?? null,
      expiresAt: w.expiresAt ? w.expiresAt.value : null,
      status: w.status,
      statusId: w.statusId ?? null,
      statusName: w.statusName ?? null,
      statusColor: w.statusColor ?? null,
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

  public static toDomain(raw: any): Wallet | null {
    if (!raw) return null;
    const domainOrError = Wallet.create(
      {
        code: raw.code,
        walletTypeId: raw.walletTypeId,
        balanceTypeId: raw.balanceTypeId,
        uomId: raw.uomId,
        ownerTypeId: raw.ownerTypeId,
        ownerId: raw.ownerId,
        parentWalletId: raw.parentWalletId ?? undefined,
        displayName: raw.displayName ?? undefined,
        balance: Number(raw.balance),
        heldAmount: Number(raw.heldAmount),
        minBalance:
          raw.minBalance === null || raw.minBalance === undefined
            ? undefined
            : Number(raw.minBalance),
        maxBalance:
          raw.maxBalance === null || raw.maxBalance === undefined
            ? undefined
            : Number(raw.maxBalance),
        dailyDebitLimit:
          raw.dailyDebitLimit === null || raw.dailyDebitLimit === undefined
            ? undefined
            : Number(raw.dailyDebitLimit),
        monthlyDebitLimit:
          raw.monthlyDebitLimit === null || raw.monthlyDebitLimit === undefined
            ? undefined
            : Number(raw.monthlyDebitLimit),
        expiresAt: Mapper.toDateOptional(raw.expiresAt),
        status: raw.status,
        statusId: raw.statusId ?? undefined,
        statusName: raw.statusName ?? undefined,
        statusColor: raw.statusColor ?? undefined,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'Wallet'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'Wallet'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('WalletMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(w: Wallet): WalletDTO {
    return {
      id: w.id.toString(),
      code: w.code,
      walletTypeId: w.walletTypeId,
      balanceTypeId: w.balanceTypeId,
      uomId: w.uomId,
      ownerTypeId: w.ownerTypeId,
      ownerId: w.ownerId,
      parentWalletId: w.parentWalletId,
      displayName: w.displayName,
      balance: w.balance,
      heldAmount: w.heldAmount,
      minBalance: w.minBalance,
      maxBalance: w.maxBalance,
      dailyDebitLimit: w.dailyDebitLimit,
      monthlyDebitLimit: w.monthlyDebitLimit,
      expiresAt: w.expiresAt ? w.expiresAt.value : undefined,
      status: w.status,
      statusId: w.statusId,
      statusName: w.statusName,
      statusColor: w.statusColor,
    };
  }
}
