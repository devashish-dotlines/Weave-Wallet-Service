import { Mapper } from '../../../core/infra/Mapper';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { ServerVersion } from '../../../core/service/serverVersion';
import { TopupRequest as TopupRequestModel } from '../../../infra/sequelize/models/Wallet/topupRequest';
import {
  TopupRequest,
  TopupChannel,
  TopupRequestState,
  TopupDepositMethod,
} from '../domain/topupRequest';
import {
  TopupRequestDTO,
  TopupRequestAttachmentDTO,
} from '../DTO/topupRequestDTO';

export class TopupRequestMap extends Mapper<TopupRequest> {
  public static async toPersistence(
    t: TopupRequest,
  ): Promise<Partial<TopupRequestModel>> {
    return {
      id: t.id.toString(),
      code: t.code,
      walletId: t.walletId,
      channel: t.channel,
      amount: t.amount,
      unitCategoryId: t.unitCategoryId,
      unitId: t.unitId,
      unitCode: t.unitCode,
      depositCurrency: t.depositCurrency,
      depositAmount: t.depositAmount,
      depositMethod: t.depositMethod,
      rate: t.rate,
      requestedBy: t.requestedBy,
      bankAccountCode: t.bankAccountCode,
      depositReference: t.depositReference,
      depositDate: t.depositDate.value,
      depositorName: t.depositorName ?? null,
      note: t.note ?? null,
      state: t.state,
      submittedAt: t.submittedAt ? t.submittedAt.value : null,
      reviewedBy: t.reviewedBy ?? null,
      reviewedAt: t.reviewedAt ? t.reviewedAt.value : null,
      decisionNote: t.decisionNote ?? null,
      walletTransactionId: t.walletTransactionId ?? null,
      glVoucherId: t.glVoucherId ?? null,
      statusId: t.statusId ?? null,
      statusName: t.statusName ?? null,
      statusColor: t.statusColor ?? null,
      statusClosed: t.statusClosed,
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

  public static toDomain(raw: any): TopupRequest | null {
    if (!raw) return null;
    const domainOrError = TopupRequest.create(
      {
        code: raw.code,
        walletId: raw.walletId,
        channel: raw.channel as TopupChannel,
        amount: Number(raw.amount),
        unitCategoryId: raw.unitCategoryId,
        unitId: raw.unitId,
        unitCode: raw.unitCode,
        depositCurrency: raw.depositCurrency,
        depositAmount: Number(raw.depositAmount),
        depositMethod: raw.depositMethod as TopupDepositMethod,
        rate: Number(raw.rate),
        requestedBy: raw.requestedBy,
        bankAccountCode: raw.bankAccountCode,
        depositReference: raw.depositReference,
        depositDate: Mapper.toDateRequired(Number(raw.depositDate), 'depositDate', 'TopupRequest'),
        depositorName: raw.depositorName ?? undefined,
        note: raw.note ?? undefined,
        state: raw.state as TopupRequestState,
        submittedAt: Mapper.toDateOptional(raw.submittedAt),
        reviewedBy: raw.reviewedBy ?? undefined,
        reviewedAt: Mapper.toDateOptional(raw.reviewedAt),
        decisionNote: raw.decisionNote ?? undefined,
        walletTransactionId: raw.walletTransactionId ?? undefined,
        glVoucherId: raw.glVoucherId ?? undefined,
        statusId: raw.statusId ?? undefined,
        statusName: raw.statusName ?? undefined,
        statusColor: raw.statusColor ?? undefined,
        statusClosed: !!raw.statusClosed,
        voided: raw.voided,
        createdBy: raw.createdBy,
        createdAt: Mapper.toDateRequired(raw.createdAt, 'createdAt', 'TopupRequest'),
        updatedBy: raw.updatedBy,
        updatedAt: Mapper.toDateRequired(raw.updatedAt, 'updatedAt', 'TopupRequest'),
        deletedBy: raw.deletedBy ?? undefined,
        deletedAt: Mapper.toDateOptional(raw.deletedAt),
      },
      new UniqueEntityID(raw.id),
    );
    if (domainOrError.isFailure) {
      console.log('TopupRequestMap.toDomain failed:', domainOrError.error);
      return null;
    }
    return domainOrError.getValue();
  }

  public static toDTO(
    t: TopupRequest,
    attachments?: TopupRequestAttachmentDTO[],
  ): TopupRequestDTO {
    return {
      id: t.id.toString(),
      code: t.code,
      walletId: t.walletId,
      channel: t.channel,
      amount: t.amount,
      unitCategoryId: t.unitCategoryId,
      unitId: t.unitId,
      unitCode: t.unitCode,
      depositCurrency: t.depositCurrency,
      depositAmount: t.depositAmount,
      depositMethod: t.depositMethod,
      rate: t.rate,
      requestedBy: t.requestedBy,
      bankAccountCode: t.bankAccountCode,
      depositReference: t.depositReference,
      depositDate: t.depositDate.value,
      depositorName: t.depositorName,
      note: t.note,
      state: t.state,
      submittedAt: t.submittedAt?.value,
      reviewedBy: t.reviewedBy,
      reviewedAt: t.reviewedAt?.value,
      decisionNote: t.decisionNote,
      walletTransactionId: t.walletTransactionId,
      glVoucherId: t.glVoucherId,
      statusId: t.statusId,
      statusName: t.statusName,
      statusColor: t.statusColor,
      statusClosed: t.statusClosed,
      createdAt: t.createdAt ? t.createdAt.value : 0,
      updatedAt: t.updatedAt ? t.updatedAt.value : 0,
      ...(attachments ? { attachments } : {}),
    };
  }
}
