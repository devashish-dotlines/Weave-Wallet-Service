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
import { WalletType } from './walletType';
import { Uom } from './uom';
import { OwnerType } from './ownerType';
import { WalletUsageRestriction } from './walletUsageRestriction';

@Table({
  tableName: 'wlt_wallet',
  underscored: true,
  timestamps: false,
  indexes: [
    // Idempotency handle for service-to-service provisioning (ProvisionWallet).
    // Wallets created through the UI leave it NULL, and Postgres treats NULLs as
    // distinct — which is exactly what lets one unique index guard the
    // provisioned wallets without constraining the hand-created ones.
    {
      name: 'uq_wlt_wallet_external_ref',
      unique: true,
      fields: ['external_ref'],
    },
  ],
})
export class Wallet extends Model<Wallet> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // Auto-generated, prefix WAL, unique.
  @Column({ type: DataType.STRING(32), unique: true })
  code!: string;

  @ForeignKey(() => WalletType)
  @Column(DataType.UUID)
  walletTypeId!: string;

  @ForeignKey(() => Uom)
  @Column(DataType.UUID)
  uomId!: string;

  // Owner-type lookup FK; ownerId stays an opaque string (owning service's id,
  // not a hard cross-service FK).
  @ForeignKey(() => OwnerType)
  @Column(DataType.UUID)
  ownerTypeId!: string;

  @Column({ type: DataType.STRING })
  ownerId!: string;

  // Caller-supplied idempotency handle, e.g. `sub:<id>:line:<id>`. NULL for
  // wallets created through the UI. See the unique index on the @Table above.
  @Column({ type: DataType.STRING(191), allowNull: true })
  externalRef!: string | null;

  // Optional hierarchical parent (self-reference).
  @ForeignKey(() => Wallet)
  @Column({ type: DataType.UUID, allowNull: true })
  parentWalletId!: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  displayName!: string | null;

  // Cached, ledger-derived (FR-WL-3). Not moved by transactions this pass.
  @Default(0)
  @Column({ type: DataType.DECIMAL(18, 2) })
  balance!: string | number;

  @Default(0)
  @Column({ type: DataType.DECIMAL(18, 2) })
  heldAmount!: string | number;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  minBalance!: string | number | null;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  maxBalance!: string | number | null;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  dailyDebitLimit!: string | number | null;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  monthlyDebitLimit!: string | number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  expiresAt!: number | null;

  // Denormalized workflow status (FR-WF-1/2) — a cache, never edited directly.
  @Default('pending')
  @Column({ type: DataType.STRING(32) })
  status!: string;

  @Column({ type: DataType.UUID, allowNull: true })
  statusId!: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  statusName!: string | null;

  @Column({ type: DataType.STRING(16), allowNull: true })
  statusColor!: string | null;

  // Usage restrictions (link rows). Empty ⇒ this balance is unrestricted.
  @HasMany(() => WalletUsageRestriction)
  usageRestrictions!: WalletUsageRestriction[];

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
