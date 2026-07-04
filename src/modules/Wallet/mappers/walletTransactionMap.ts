import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { WalletTransaction as WalletTransactionModel } from '../../../infra/sequelize/models/Wallet/walletTransaction';
import {
  WalletTransaction,
  WalletTxType,
  WalletTxDirection,
  WalletTxState,
} from '../domain/walletTransaction';
import { WalletTransactionDTO } from '../DTO/walletTransactionDTO';

export class WalletTransactionMap extends Mapper<WalletTransaction> {
  public static async toPersistence(
    t: WalletTransaction,
  ): Promise<Partial<WalletTransactionModel>> {
    return {
      id: t.id.toString(),
      code: t.code,
      walletId: t.walletId,
      txType: t.txType,
      direction: t.direction,
      counterpartyWalletId: t.counterpartyWalletId ?? null,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      state: t.state,
      idempotencyKey: t.idempotencyKey ?? null,
      parentTransactionId: t.parentTransactionId ?? null,
      description: t.description ?? null,
      voided: t.voided ?? false,
      createdBy: t.createdBy,
      createdAt: t.createdAt ? t.createdAt.value : 0,
      updatedBy: t.updatedBy,
      updatedAt: t.updatedAt ? t.updatedAt.value : 0,
      deletedBy: t.deletedBy ?? null,
      deletedAt: t.deletedAt ? t.deletedAt.value : null,
      serverVersion: await new ServerVersion().getServerVersion(),
    };
  }

  public static toDomain(raw: any): WalletTransaction | null {
    if (!raw) return null;
    const domainOrError = WalletTransaction.create(
      {
        code: raw.code,
        walletId: raw.walletId,
        txType: raw.txType as WalletTxType,
        direction: raw.direction as WalletTxDirection,
        counterpartyWalletId: raw.counterpartyWalletId ?? undefined,
        amount: Number(raw.amount),
        balanceBefore: Number(raw.balanceBefore),
        balanceAfter: Number(raw.balanceAfter),
        state: raw.state as WalletTxState,
        idempotencyKey: raw.idempotencyKey ?? undefined,
        parentTransactionId: raw.parentTransactionId ?? undefined,
        description: raw.description ?? undefined,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'WalletTransaction'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'WalletTransaction'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('WalletTransactionMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(t: WalletTransaction): WalletTransactionDTO {
    return {
      id: t.id.toString(),
      code: t.code,
      walletId: t.walletId,
      txType: t.txType,
      direction: t.direction,
      counterpartyWalletId: t.counterpartyWalletId,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      state: t.state,
      idempotencyKey: t.idempotencyKey,
      parentTransactionId: t.parentTransactionId,
      description: t.description,
      createdAt: t.createdAt ? t.createdAt.value : 0,
    };
  }
}
