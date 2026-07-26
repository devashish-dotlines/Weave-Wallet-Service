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
 * An admin-defined axis a wallet's balance can be restricted along — call type,
 * bundle, time band, and whatever the business needs next. Modelled on the Rate
 * Engine's `Variable` (minus its variable-type grouping): a typed input with
 * optional constraints on what it may hold.
 *
 * A dimension may CONSTRAIN its values (a select's inline options, a string's
 * comma-separated allowed list, a numeric min/max) or be left OPEN, in which
 * case the value is typed when the wallet is created.
 *
 * The `key` is what a spend-time usage context is keyed by, so it is treated as
 * immutable once created (see UpdateUsageDimensionUseCase).
 */
@Table({ tableName: 'wlt_usage_dimension', underscored: true, timestamps: false })
export class UsageDimension extends Model<UsageDimension> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column
  name!: string;

  // Unique machine key, lowercase (e.g. call_type, bundle). Keyed on by contexts.
  @Column({ type: DataType.STRING(80), unique: true })
  key!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  description!: string | null;

  // 'integer' | 'decimal' | 'string' | 'boolean' | 'single_select' | 'multi_select'
  @Column({ type: DataType.STRING(16) })
  dataType!: string;

  // Numeric types only.
  @Column({ type: DataType.DECIMAL(18, 4), allowNull: true })
  minValue!: string | number | null;

  @Column({ type: DataType.DECIMAL(18, 4), allowNull: true })
  maxValue!: string | number | null;

  // String type only — comma-separated allowed set. Null ⇒ open.
  @Column({ type: DataType.TEXT, allowNull: true })
  allowedValues!: string | null;

  // Select types only — JSON array of {key, value}. Null ⇒ none defined yet.
  @Column({ type: DataType.TEXT, allowNull: true })
  options!: string | null;

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
