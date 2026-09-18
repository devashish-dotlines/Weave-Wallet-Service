import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript';
import { Wallet } from './wallet';
import { Uom } from './uom';
import { WalletTransaction } from './walletTransaction';
import { TopupRequestAttachment } from './topupRequestAttachment';

@Table({
  tableName: 'wlt_topup_request',
  underscored: true,
  timestamps: false,
  indexes: [
    { name: 'idx_wlt_topup_request_wallet', fields: ['wallet_id'] },
    { name: 'idx_wlt_topup_request_state', fields: ['state'] },
    // Duplicate-slip detection looks up by bank account + reference.
    {
      name: 'idx_wlt_topup_request_deposit_ref',
      fields: ['bank_account_code', 'deposit_reference'],
    },
  ],
})
export class TopupRequest extends Model<TopupRequest> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // Auto-generated, prefix TUR, unique.
  @Column({ type: DataType.STRING(40), unique: true })
  code!: string;

  @ForeignKey(() => Wallet)
  @Column(DataType.UUID)
  walletId!: string;

  // 'BANK_DEPOSIT' (GATEWAY later).
  @Column({ type: DataType.STRING(24) })
  channel!: string;

  // What the wallet gets, in the wallet's UOM (deposit / rate, rounded down).
  @Column({ type: DataType.DECIMAL(18, 2) })
  amount!: string | number;

  // Currency actually paid in (ISO-ish code, e.g. BDT, MYR).
  @Column({ type: DataType.STRING(8) })
  depositCurrency!: string;

  // Amount on the slip, in depositCurrency.
  @Column({ type: DataType.DECIMAL(18, 2) })
  depositAmount!: string | number;

  // 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'MFS' | 'BILL_PAYMENT'
  @Column({ type: DataType.STRING(24) })
  depositMethod!: string;

  // Currency per ONE wallet unit at creation time (1 POINT = 30 BDT -> 30).
  @Column({ type: DataType.DECIMAL(18, 6) })
  rate!: string | number;

  // LEGACY (pre unit categories): no longer written; dropped next release.
  @ForeignKey(() => Uom)
  @Column({ type: DataType.UUID, allowNull: true })
  uomId!: string | null;

  // The wallet's unit, copied at creation so the request reads on its own.
  // Nullable in the DB only so DB_SYNC can add the columns.
  @Column({ type: DataType.UUID, allowNull: true })
  unitCategoryId!: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  unitId!: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  unitCode!: string | null;

  // Gateway subject of the owner who raised it.
  @Column({ type: DataType.STRING })
  requestedBy!: string;

  // WALLET_TOPUP.bank_accounts[].code from the configuration service.
  @Column({ type: DataType.STRING(64) })
  bankAccountCode!: string;

  @Column({ type: DataType.STRING(128) })
  depositReference!: string;

  // Unix seconds.
  @Column({ type: DataType.BIGINT })
  depositDate!: number;

  @Column({ type: DataType.STRING(160), allowNull: true })
  depositorName!: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  note!: string | null;

  // 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CREDITED' | 'CANCELLED'
  @Default('DRAFT')
  @Column({ type: DataType.STRING(16) })
  state!: string;

  @Column({ type: DataType.BIGINT, allowNull: true })
  submittedAt!: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  reviewedBy!: string | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  reviewedAt!: number | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  decisionNote!: string | null;

  @ForeignKey(() => WalletTransaction)
  @Column({ type: DataType.UUID, allowNull: true })
  walletTransactionId!: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  glVoucherId!: string | null;

  // Denormalized workflow status (cache of the engine's instance status).
  @Column({ type: DataType.STRING, allowNull: true })
  statusId!: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  statusName!: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true })
  statusColor!: string | null;

  @Default(false)
  @Column
  statusClosed!: boolean;

  @HasMany(() => TopupRequestAttachment)
  attachments!: TopupRequestAttachment[];

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
