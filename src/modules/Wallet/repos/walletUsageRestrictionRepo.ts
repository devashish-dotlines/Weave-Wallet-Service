import { Transaction } from 'sequelize';
import { BaseRepo } from '../../../core/infra/BaseRepo';
import { ServerVersion } from '../../../core/service/serverVersion';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { WalletUsageRestriction } from '../domain/walletUsageRestriction';
import { UsageRestrictionRule } from '../domain/usageContext';
import { WalletUsageRestrictionMap } from '../mappers/walletUsageRestrictionMap';
import { IWalletUsageRestrictionRepo } from './interface/IWalletUsageRestrictionRepo';

export class WalletUsageRestrictionRepo
  extends BaseRepo
  implements IWalletUsageRestrictionRepo
{
  constructor(models: any) {
    super(models, models.WalletUsageRestriction);
  }

  public async listByWallet(
    walletId: string,
  ): Promise<WalletUsageRestriction[]> {
    const q = this.createBaseQuery();
    q.where['walletId'] = walletId;
    q.where['voided'] = false;
    const instances = await this.baseModel.findAll(q);
    const out: WalletUsageRestriction[] = [];
    for (const instance of instances) {
      const d = WalletUsageRestrictionMap.toDomain(instance);
      if (d) out.push(d);
    }
    return out;
  }

  /**
   * A wallet with no live rows is unrestricted. The spend path calls this before
   * loading anything, so the common case costs one COUNT — the same shortcut
   * `BalanceTypeRepo.isUomAllowed` takes.
   */
  public async countByWallet(walletId: string): Promise<number> {
    return this.baseModel.count({ where: { walletId, voided: false } });
  }

  /**
   * Rules flattened for evaluation. Rows store `usageDimensionId`, but a usage
   * context is keyed by dimension CODE, so join to resolve it. A row whose
   * dimension is gone or inactive is dropped rather than failing the spend —
   * a deactivated dimension should stop restricting, not start blocking.
   */
  public async listRulesForEvaluation(
    walletId: string,
  ): Promise<UsageRestrictionRule[]> {
    const instances = await this.baseModel.findAll({
      where: { walletId, voided: false },
      include: [
        {
          model: this.models.UsageDimension,
          where: { voided: false, isActive: true },
          required: true,
        },
      ],
    });

    const out: UsageRestrictionRule[] = [];
    for (const instance of instances) {
      const domain = WalletUsageRestrictionMap.toDomain(instance);
      const code = instance.UsageDimension?.code ?? instance.usageDimension?.code;
      if (!domain || !code) continue;
      out.push({
        dimensionCode: String(code),
        operator: domain.operator,
        valueKeys: domain.valueKeys,
        groupNo: domain.groupNo,
      });
    }
    return out;
  }

  /**
   * Replace the wallet's whole restriction set. Reconciles on
   * `dimensionId:groupNo`: revive rows that come back, void the ones dropped,
   * refresh operator/values on survivors, insert the rest. Opens its own
   * transaction unless the caller supplies one.
   */
  public async replaceForWallet(
    walletId: string,
    restrictions: WalletUsageRestriction[],
    requestedBy: string,
    txn?: Transaction,
  ): Promise<void> {
    const owned = !txn;
    const t: Transaction = txn ?? (await this.models['sequelize'].transaction());
    try {
      const now = DateTimeObject.create(-1).getValue().value;
      const serverVersion = await new ServerVersion().getServerVersion();
      const keyOf = (dimensionId: string, groupNo: number) =>
        `${dimensionId}:${groupNo}`;

      const wanted = new Map(
        restrictions.map((r) => [
          keyOf(r.usageDimensionId, r.groupNo),
          r,
        ]),
      );
      const rows = await this.baseModel.findAll({
        where: { walletId },
        transaction: t,
      });

      for (const row of rows) {
        const key = keyOf(row.usageDimensionId, row.groupNo ?? 0);
        const keep = wanted.get(key);
        if (keep) {
          wanted.delete(key);
          await row.update(
            {
              operator: keep.operator,
              valueKeys: JSON.stringify(keep.valueKeys),
              voided: false,
              deletedAt: null,
              deletedBy: null,
              updatedAt: now,
              updatedBy: requestedBy,
              serverVersion,
            },
            { transaction: t },
          );
        } else if (!row.voided) {
          await row.update(
            {
              voided: true,
              deletedAt: now,
              deletedBy: requestedBy,
              updatedAt: now,
              updatedBy: requestedBy,
              serverVersion,
            },
            { transaction: t },
          );
        }
      }

      for (const r of wanted.values()) {
        await this.baseModel.create(
          {
            walletId,
            usageDimensionId: r.usageDimensionId,
            operator: r.operator,
            valueKeys: JSON.stringify(r.valueKeys),
            groupNo: r.groupNo,
            voided: false,
            createdAt: now,
            createdBy: requestedBy,
            updatedAt: now,
            updatedBy: requestedBy,
            serverVersion,
          },
          { transaction: t },
        );
      }

      if (owned) await t.commit();
    } catch (err) {
      if (owned) await t.rollback();
      throw new Error(err as any);
    }
  }
}
