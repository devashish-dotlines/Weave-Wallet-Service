import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
} from 'sequelize-typescript';

/**
 * What KIND of unit a wallet holds, and where its units come from:
 *
 *   CURRENCY  unit_source ACCOUNTING_CURRENCY  units = accounting acc_currency
 *   POINTS    unit_source LOCAL                units = wlt_uom (valued: rates)
 *   TIME      unit_source LOCAL                units = wlt_uom (quantity only)
 *   DATA      unit_source LOCAL                units = wlt_uom (quantity only)
 *
 * A new source of units (an external catalogue, say) is a new `unit_source`
 * value, not a new table on every wallet.
 */
@Table({
  tableName: 'wlt_uom_category',
  underscored: true,
  timestamps: false,
  indexes: [{ name: 'uq_wlt_uom_category_code', unique: true, fields: ['code'] }],
})
export class UomCategory extends Model<UomCategory> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // CURRENCY | POINTS | TIME | DATA … upper-cased, immutable.
  @Column({ type: DataType.STRING(32) })
  code!: string;

  @Column
  name!: string;

  // 'ACCOUNTING_CURRENCY' | 'LOCAL'. Immutable: it decides which table unit ids point at.
  @Column({ type: DataType.STRING(32) })
  unitSource!: string;

  // Has a money value (can be priced, topped up, posted to the GL).
  @Default(false)
  @Column
  valued!: boolean;

  // Max decimals an amount in this category may carry (0–2; balances are DECIMAL(18,2)).
  @Default(2)
  @Column(DataType.INTEGER)
  decimals!: number;

  // LOCAL only: the unit factors are relative to. Plain UUID, not an FK — wlt_uom
  // already references this table, and a cycle would break DB_SYNC ordering.
  @Column({ type: DataType.UUID, allowNull: true })
  baseUomId!: string | null;

  @Default(true)
  @Column
  isActive!: boolean;

  @Default(false)
  @Column
  voided!: boolean;

  @Column({ type: DataType.BIGINT })
  createdAt!: number;

  @Column({ type: DataType.BIGINT })
  updatedAt!: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  deletedAt!: number | null;

  @Column
  createdBy!: string;

  @Column
  updatedBy!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  deletedBy!: string | null;

  @Column
  serverVersion!: number;
}
