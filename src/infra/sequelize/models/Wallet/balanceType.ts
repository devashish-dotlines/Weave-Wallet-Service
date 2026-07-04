import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
} from 'sequelize-typescript';

@Table({ tableName: 'wlt_balance_type', underscored: true, timestamps: false })
export class BalanceType extends Model<BalanceType> {
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
  description!: string | null;

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
