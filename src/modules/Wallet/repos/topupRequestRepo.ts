import { Op } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { ServerVersion } from '../../../core/service/serverVersion';
import {
  TopupRequest,
  TopupRequestState,
} from '../domain/topupRequest';
import { TopupRequestAttachment } from '../domain/topupRequestAttachment';
import { TopupRequestMap } from '../mappers/topupRequestMap';
import { TopupRequestAttachmentMap } from '../mappers/topupRequestAttachmentMap';
import {
  ITopupRequestRepo,
  TopupRequestFilter,
  TopupRequestPage,
  TopupStatusProjection,
} from './interface/ITopupRequestRepo';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEAD_STATES: TopupRequestState[] = ['REJECTED', 'CANCELLED'];

export class TopupRequestRepo extends BaseRepo implements ITopupRequestRepo {
  constructor(models: any) {
    super(models, models.TopupRequest);
  }

  private get attachmentModel(): any {
    return this.models.TopupRequestAttachment;
  }

  private now(): number {
    return DateTimeObject.create(-1).getValue().value;
  }

  public async exists(id: string): Promise<boolean> {
    return !!(await this.baseModel.findOne({ where: { id, voided: false } }));
  }

  public async findById(id: string): Promise<TopupRequest | null> {
    const instance = await this.baseModel.findOne({
      where: { id, voided: false },
    });
    return instance ? TopupRequestMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<TopupRequest | null> {
    const instance = await this.baseModel.findOne({
      where: { code: code.trim().toUpperCase(), voided: false },
    });
    return instance ? TopupRequestMap.toDomain(instance) : null;
  }

  public async list(filter: TopupRequestFilter): Promise<TopupRequestPage> {
    const where: any = { voided: false };
    if (filter.walletId) where.walletId = filter.walletId;
    if (filter.state) where.state = filter.state;
    if (filter.requestedBy) where.requestedBy = filter.requestedBy;
    if (filter.createdFrom !== undefined || filter.createdTo !== undefined) {
      where.createdAt = {};
      if (filter.createdFrom !== undefined) where.createdAt[Op.gte] = filter.createdFrom;
      if (filter.createdTo !== undefined) where.createdAt[Op.lte] = filter.createdTo;
    }
    const limit = Math.min(Math.max(filter.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = Math.max(filter.offset ?? 0, 0);

    const { rows, count } = await this.baseModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const items: TopupRequest[] = [];
    for (const row of rows) {
      const d = TopupRequestMap.toDomain(row);
      if (d) items.push(d);
    }
    return { items, total: count };
  }

  public async existsLiveDeposit(
    bankAccountCode: string,
    depositReference: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: any = {
      bankAccountCode,
      depositReference: depositReference.trim(),
      voided: false,
      state: { [Op.notIn]: DEAD_STATES },
    };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    return !!(await this.baseModel.findOne({ where, attributes: ['id'] }));
  }

  public async create(request: TopupRequest): Promise<string> {
    const persistent = await TopupRequestMap.toPersistence(request);
    const saved = await this.baseModel.create(persistent);
    return saved.id;
  }

  public async saveTransition(
    request: TopupRequest,
    expectedState: TopupRequestState,
  ): Promise<boolean> {
    const persistent = await TopupRequestMap.toPersistence(request);
    // Identity and creation facts never change after create.
    const {
      id,
      code,
      walletId,
      unitCategoryId,
      unitId,
      unitCode,
      requestedBy,
      createdAt,
      createdBy,
      ...changes
    } = persistent;
    const [affected] = await this.baseModel.update(changes, {
      where: { id: request.id.toString(), state: expectedState, voided: false },
    });
    return affected > 0;
  }

  public async setWorkflowStatus(
    id: string,
    s: TopupStatusProjection,
  ): Promise<void> {
    await this.baseModel.update(
      {
        statusId: s.statusId,
        statusName: s.statusName ?? null,
        statusColor: s.statusColor ?? null,
        statusClosed: s.statusClosed ?? false,
        updatedAt: this.now(),
        serverVersion: await new ServerVersion().getServerVersion(),
      },
      { where: { id } },
    );
  }

  public async setGlVoucher(id: string, glVoucherId: string): Promise<void> {
    await this.baseModel.update(
      {
        glVoucherId,
        updatedAt: this.now(),
        serverVersion: await new ServerVersion().getServerVersion(),
      },
      { where: { id } },
    );
  }

  public async listAttachments(
    topupRequestId: string,
  ): Promise<TopupRequestAttachment[]> {
    const rows = await this.attachmentModel.findAll({
      where: { topupRequestId, voided: false },
      order: [['createdAt', 'ASC']],
    });
    const out: TopupRequestAttachment[] = [];
    for (const row of rows) {
      const d = TopupRequestAttachmentMap.toDomain(row);
      if (d) out.push(d);
    }
    return out;
  }

  public async findAttachment(
    topupRequestId: string,
    attachmentId: string,
  ): Promise<TopupRequestAttachment | null> {
    // Scoped by BOTH ids so an attachment can't be read through another request.
    const row = await this.attachmentModel.findOne({
      where: { id: attachmentId, topupRequestId, voided: false },
    });
    return row ? TopupRequestAttachmentMap.toDomain(row) : null;
  }

  public async countAttachments(topupRequestId: string): Promise<number> {
    return this.attachmentModel.count({
      where: { topupRequestId, voided: false },
    });
  }

  public async addAttachment(attachment: TopupRequestAttachment): Promise<string> {
    const persistent = await TopupRequestAttachmentMap.toPersistence(attachment);
    const saved = await this.attachmentModel.create(persistent);
    return saved.id;
  }

  public async deleteAttachment(
    topupRequestId: string,
    attachmentId: string,
    deletedBy: string,
  ): Promise<boolean> {
    const now = this.now();
    const [affected] = await this.attachmentModel.update(
      {
        voided: true,
        deletedAt: now,
        deletedBy,
        updatedAt: now,
        updatedBy: deletedBy,
        serverVersion: await new ServerVersion().getServerVersion(),
      },
      { where: { id: attachmentId, topupRequestId, voided: false } },
    );
    return affected > 0;
  }
}
