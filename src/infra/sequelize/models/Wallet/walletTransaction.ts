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
import { Wallet } from './wallet';

@Table({ tableName: 'wlt_wallet_transaction', underscored: true, timestamps: false })
export class WalletTransaction extends Model<WalletTransaction> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // Auto-generated, prefix WTX, unique.
  @Column({ type: DataType.STRING(40), unique: true })
  code!: string;

  @ForeignKey(() => Wallet)
  @Column(DataType.UUID)
  walletId!: string;

  // 'credit' | 'debit' | 'transfer' | 'adjustment'
  @Column({ type: DataType.STRING(16) })
  txType!: string;

  // 'credit' | 'debit' — sign of the balance change applied to walletId.
  @Column({ type: DataType.STRING(8) })
  direction!: string;

  // The other wallet involved in a transfer.
  @ForeignKey(() => Wallet)
  @Column({ type: DataType.UUID, allowNull: true })
  counterpartyWalletId!: string | null;

  @Column({ type: DataType.DECIMAL(18, 2) })
  amount!: string | number;

  @Column({ type: DataType.DECIMAL(18, 2) })
  balanceBefore!: string | number;

  @Column({ type: DataType.DECIMAL(18, 2) })
  balanceAfter!: string | number;

  // 'pending' | 'completed' | 'failed' | 'reversed' | 'cancelled'
  @Default('completed')
  @Column({ type: DataType.STRING(16) })
  state!: string;

  // At-most-once key for the logical operation (FR-TX-8). Unique when present.
  @Column({ type: DataType.STRING(128), allowNull: true, unique: true })
  idempotencyKey!: string | null;

  // Links the two legs of a transfer (credit leg → debit leg).
  @Column({ type: DataType.UUID, allowNull: true })
  parentTransactionId!: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  description!: string | null;

  // What caused the movement: 'BANK_DEPOSIT' | 'TRANSFER' | 'ADMIN' | 'PROVISION'.
  @Column({ type: DataType.STRING(24), allowNull: true })
  sourceType!: string | null;

  // Reference into the originating record, e.g. 'TUR:<topup code>' or a
  // provisioning externalRef (same 191 width as wallet.external_ref).
  @Column({ type: DataType.STRING(191), allowNull: true })
  sourceRef!: string | null;

  // Accounting voucher posted for this movement; null until posted.
  @Column({ type: DataType.STRING(64), allowNull: true })
  glVoucherId!: string | null;

  // Last FAILED GL posting attempt (unix seconds); the reconciler waits a retry
  // window before trying the row again, so poison rows can't starve the sweep.
  @Column({ type: DataType.BIGINT, allowNull: true })
  glLastAttemptAt!: number | null;

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
