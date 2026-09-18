import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
  ForeignKey,
} from 'sequelize-typescript';
import { Uom } from './uom';

/**
 * What one unit of a wallet UOM is worth in the ACCOUNTING BASE CURRENCY
 * (1 POINT = 30 BDT when base is BDT). Anchoring to base keeps this to one row
 * per unit: a deposit in any currency converts as
 *
 *   credit = depositAmount × rate(currency -> base) / baseValue
 *
 * where the currency's rate to base (base amount one unit of it is worth)
 * comes from accounting (`acc_currency`).
 * Rows are effective-dated windows [effectiveFrom, effectiveTo], never edited
 * in place except to close an open-ended one, so an already-created top-up
 * request can always be re-derived from the rate it stored. Windows for one
 * UOM may not overlap.
 */
@Table({
  tableName: 'wlt_uom_rate',
  underscored: true,
  timestamps: false,
  indexes: [
    // findEffective looks up by unit + window start.
    { name: 'idx_wlt_uom_rate_uom_effective', fields: ['uom_id', 'effective_from'] },
  ],
})
export class UomRate extends Model<UomRate> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Uom)
  @Column(DataType.UUID)
  uomId!: string;

  // Base-currency amount one unit is worth. 6 dp so small units stay precise.
  @Column({ type: DataType.DECIMAL(18, 6) })
  baseValue!: string | number;

  // Unix seconds, inclusive start of the window.
  @Column({ type: DataType.BIGINT })
  effectiveFrom!: number;

  // Unix seconds, inclusive end. NULL = open-ended (in force until superseded).
  @Column({ type: DataType.BIGINT, allowNull: true })
  effectiveTo!: number | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  note!: string | null;

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
