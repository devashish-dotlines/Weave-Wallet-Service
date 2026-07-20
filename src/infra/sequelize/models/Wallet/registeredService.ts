import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
  Unique,
} from 'sequelize-typescript';

/**
 * A microservice registered to call this Wallet service. Holds its opaque API
 * key — the service-to-service credential matched on gRPC/REST `x-api-key`.
 * `isActive=false` (revoked) ⇒ the key stops resolving without rotating any
 * shared secret. Mirrors the Accounts/Product service-registry.
 */
@Table({ tableName: 'registered_service', underscored: true, timestamps: false })
export class RegisteredService extends Model<RegisteredService> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Unique
  @Column({ type: DataType.STRING(120) })
  name!: string; // stable service name, e.g. 'rateengine'

  @Unique
  @Column({ type: DataType.STRING(200) })
  apiKey!: string; // opaque random token (the x-api-key the service presents)

  @Column({ type: DataType.STRING(400), allowNull: true })
  description!: string | null;

  @Default(true)
  @Column
  isActive!: boolean; // false = revoked

  // --- audit (BIGINT unix-seconds, hand-managed) ---
  @Default(false)
  @Column
  voided!: boolean;

  @Column({ type: DataType.BIGINT, allowNull: true })
  createdAt!: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  updatedAt!: number;

  @Column({ type: DataType.BIGINT, allowNull: true })
  deletedAt!: number;

  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string;

  @Column({ type: DataType.UUID, allowNull: true })
  updatedBy!: string;

  @Column({ type: DataType.UUID, allowNull: true })
  deletedBy!: string;

  @Default(0)
  @Column
  serverVersion!: number;
}
