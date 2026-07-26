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
import { UsageDimension } from './usageDimension';
import { Wallet } from './wallet';

/**
 * A restriction tagged onto one wallet along one usage dimension: this balance
 * may only be spent when the usage context matches. A wallet with no live rows
 * here is unrestricted, mirroring the balance-type/UOM tag convention.
 *
 * `valueKeys` holds a JSON array of dimension-value CODES. It is deliberately
 * TEXT-holding-JSON rather than a link table: it keeps a rule atomic (operator
 * and its values can never disagree), and it is the shape numeric operators
 * would later reuse via valueKeys[0]/valueKeys[1]. The column is `value_keys`,
 * NOT `values` — VALUES is a MySQL reserved word and would break raw queries.
 */
@Table({
  tableName: 'wlt_wallet_usage_restriction',
  underscored: true,
  timestamps: false,
})
export class WalletUsageRestriction extends Model<WalletUsageRestriction> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Wallet)
  @Column(DataType.UUID)
  walletId!: string;

  @ForeignKey(() => UsageDimension)
  @Column(DataType.UUID)
  usageDimensionId!: string;

  // 'in' | 'not_in'. STRING, not an ENUM, so later operators need no DDL change.
  @Column({ type: DataType.STRING(16) })
  operator!: string;

  // JSON array of dimension-value codes.
  @Column({ type: DataType.TEXT })
  valueKeys!: string;

  /**
   * Reserved: AND within a group, OR across groups. Everything ships in group 0
   * and the panel does not expose it — it exists so "local calls at any time OR
   * any call off-peak" needs no schema change, which in a service with no
   * migrations means no extra restart.
   */
  @Default(0)
  @Column({ type: DataType.INTEGER })
  groupNo!: number;

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
