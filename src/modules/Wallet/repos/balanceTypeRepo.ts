import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { ServerVersion } from '../../../core/service/serverVersion';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { BalanceType } from '../domain/balanceType';
import { BalanceTypeMap } from '../mappers/balanceTypeMap';
import { IBalanceTypeRepo } from './interface/IBalanceTypeRepo';

export class BalanceTypeRepo extends BaseRepo implements IBalanceTypeRepo {
  constructor(models: any) {
    super(models, models.BalanceType);
  }

  /** Eager-load the live UOM tags so `toDomain` can resolve `allowedUomIds`. */
  private allowedUomInclude() {
    return {
      model: this.models.BalanceTypeUom,
      as: 'allowedUoms',
      where: { voided: false },
      required: false,
    };
  }

  public async exists(id: string): Promise<boolean> {
    const q = this.createBaseQuery();
    q.where['id'] = id;
    q.where['voided'] = false;
    return !!(await this.baseModel.findOne(q));
  }

  public async findById(id: string): Promise<BalanceType | null> {
    const q = this.createBaseQuery([this.allowedUomInclude()]);
    q.where['id'] = id;
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? BalanceTypeMap.toDomain(instance) : null;
  }

  public async findByCode(code: string): Promise<BalanceType | null> {
    const q = this.createBaseQuery([this.allowedUomInclude()]);
    q.where['code'] = code.trim().toUpperCase();
    q.where['voided'] = false;
    const instance = await this.baseModel.findOne(q);
    return instance ? BalanceTypeMap.toDomain(instance) : null;
  }

  public async list(): Promise<BalanceType[]> {
    const q = this.createBaseQuery([this.allowedUomInclude()]);
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: BalanceType[] = [];
    for (const instance of instances) {
      const d = BalanceTypeMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  /**
   * A balance type with no live tags is unrestricted, so every UOM passes —
   * this mirrors `BalanceType.allowsUom` without loading the aggregate.
   */
  public async isUomAllowed(
    balanceTypeId: string,
    uomId: string,
  ): Promise<boolean> {
    const link = this.models.BalanceTypeUom;
    const tagged = await link.count({
      where: { balanceTypeId, voided: false },
    });
    if (tagged === 0) return true;
    const match = await link.count({
      where: { balanceTypeId, uomId, voided: false },
    });
    return match > 0;
  }

  public async countWalletTypesByBalanceType(
    balanceTypeId: string,
  ): Promise<number> {
    return this.models.WalletType.count({
      where: { balanceTypeId, voided: false },
    });
  }

  /**
   * Reconcile the link rows against the domain's tag list: revive tags that
   * come back, void the ones that were dropped, insert the new ones. Runs
   * inside the caller's transaction so the aggregate saves atomically.
   */
  private async syncAllowedUoms(
    domainObject: BalanceType,
    txn: Transaction,
  ): Promise<void> {
    const link = this.models.BalanceTypeUom;
    const balanceTypeId = domainObject.id.toString();
    const actor = domainObject.updatedBy;
    const now = DateTimeObject.create(-1).getValue().value;
    const serverVersion = await new ServerVersion().getServerVersion();

    const wanted = new Set(domainObject.allowedUomIds);
    const rows = await link.findAll({
      where: { balanceTypeId },
      transaction: txn,
    });

    for (const row of rows) {
      const keep = wanted.delete(row.uomId);
      if (keep && row.voided) {
        await row.update(
          {
            voided: false,
            deletedAt: null,
            deletedBy: null,
            updatedAt: now,
            updatedBy: actor,
            serverVersion,
          },
          { transaction: txn },
        );
      } else if (!keep && !row.voided) {
        await row.update(
          {
            voided: true,
            deletedAt: now,
            deletedBy: actor,
            updatedAt: now,
            updatedBy: actor,
            serverVersion,
          },
          { transaction: txn },
        );
      }
    }

    for (const uomId of wanted) {
      await link.create(
        {
          balanceTypeId,
          uomId,
          voided: false,
          createdAt: now,
          createdBy: actor,
          updatedAt: now,
          updatedBy: actor,
          serverVersion,
        },
        { transaction: txn },
      );
    }
  }

  public async create(domainObject: BalanceType): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const persistentObj = await BalanceTypeMap.toPersistence(domainObject);
      const saved = await this.baseModel.create(persistentObj, {
        transaction: txn,
      });
      await this.syncAllowedUoms(domainObject, txn);
      await txn.commit();
      return saved.id;
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }

  public async update(domainObject: BalanceType): Promise<string | null> {
    let txn!: Transaction;
    try {
      txn = await this.models['sequelize'].transaction();
      const existing = await this.baseModel.findOne({
        where: { id: domainObject.id.toString() },
        transaction: txn,
      });
      if (!existing) throw new Error('No BalanceType exists with this id');
      const persistentObj = await BalanceTypeMap.toPersistence(domainObject);
      const saved = await existing.update(persistentObj, { transaction: txn });
      await this.syncAllowedUoms(domainObject, txn);
      await txn.commit();
      return saved.id;
    } catch (err) {
      if (txn) await txn.rollback();
      throw new Error(err as any);
    }
  }
}
