import { Model, Column, Table, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * Where a retired wlt_uom row went when currencies moved to accounting:
 * the old BDT/USD uom id → its unit category + acc_currency id. Written once by
 * scripts/migrate-unit-categories.js. Lets callers that still send a legacy
 * `uom_id` (ProvisionWallet, partner types, bundle types) keep working until
 * they move to unit_category_id + unit_id.
 */
@Table({ tableName: 'wlt_uom_legacy_map', underscored: true, timestamps: false })
export class UomLegacyMap extends Model<UomLegacyMap> {
  @PrimaryKey
  @Column(DataType.UUID)
  legacyUomId!: string;

  @Column(DataType.UUID)
  unitCategoryId!: string;

  @Column(DataType.UUID)
  unitId!: string;

  @Column({ type: DataType.STRING(32) })
  unitCode!: string;

  @Column({ type: DataType.BIGINT })
  createdAt!: number;
}
