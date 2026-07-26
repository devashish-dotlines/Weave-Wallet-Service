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
import { BalanceType } from './balanceType';
import { Uom } from './uom';

/**
 * Link table tagging which UOMs a balance type may be denominated in — not every
 * UOM is meaningful for every balance type (e.g. CASH in BDT/USD, POINTS in PTS).
 * A balance type with no live rows here is unrestricted (any UOM allowed).
 */
@Table({
  tableName: 'wlt_balance_type_uom',
  underscored: true,
  timestamps: false,
})
export class BalanceTypeUom extends Model<BalanceTypeUom> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => BalanceType)
  @Column(DataType.UUID)
  balanceTypeId!: string;

  @ForeignKey(() => Uom)
  @Column(DataType.UUID)
  uomId!: string;

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
