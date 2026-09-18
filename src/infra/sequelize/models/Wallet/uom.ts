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
import { UomCategory } from './uomCategory';

/**
 * A LOCAL unit (POINTS, MINUTE, HOUR, MB, GB …). Currencies are not stored
 * here: a CURRENCY-category balance points straight at accounting's
 * acc_currency, the single source for money.
 */
@Table({ tableName: 'wlt_uom', underscored: true, timestamps: false })
export class Uom extends Model<Uom> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column
  name!: string;

  // Short code, stored upper-cased, unique.
  @Column({ type: DataType.STRING(32), unique: true })
  code!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  symbol!: string | null;

  // Must be a LOCAL category. Nullable in the DB only so DB_SYNC can add it to
  // existing rows; the unit-category migration fills it and the domain requires it.
  @ForeignKey(() => UomCategory)
  @Column({ type: DataType.UUID, allowNull: true })
  categoryId!: string | null;

  // How many of the category's base unit one of this is (GB = 1024 when MB is base).
  @Default(1)
  @Column({ type: DataType.DECIMAL(24, 8) })
  factorToBase!: string | number;

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
