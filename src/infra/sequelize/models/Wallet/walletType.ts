import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
} from 'sequelize-typescript';

@Table({ tableName: 'wlt_wallet_type', underscored: true, timestamps: false })
export class WalletType extends Model<WalletType> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column
  name!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  description!: string | null;

  // 'prepaid' | 'postpaid' | 'reward' | 'escrow'
  @Column({ type: DataType.STRING(16) })
  category!: string;

  @Default(false)
  @Column
  overdraftAllowed!: boolean;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  overdraftLimit!: string | number | null;

  @Default(false)
  @Column
  allowTransfersOut!: boolean;

  @Default(false)
  @Column
  allowWithdrawals!: boolean;

  @Default(0)
  @Column({ type: DataType.INTEGER })
  requiredKycLevel!: number;

  @Column({ type: DataType.STRING, allowNull: true })
  glAccountCode!: string | null;

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
