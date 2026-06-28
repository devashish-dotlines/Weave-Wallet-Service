import {
  Model,
  Column,
  Table,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
  HasOne,
} from 'sequelize-typescript';

@Table({ tableName: 'api_key', underscored: true, timestamps: false })
export class APIKey extends Model<APIKey> {
  @IsUUID(4)
  @PrimaryKey
  @Column
  id!: string;

  @Column({ type: DataType.BIGINT })
  accountId!: number;

  @Column({
    type: DataType.STRING(1000),
  })
  apiKey!: string;

  @Column
  revokeReason!: string;

  @Default(false)
  @Column
  voided!: boolean;

  @Column({ type: DataType.BIGINT })
  createdAt!: number;

  @Column({ type: DataType.BIGINT })
  deletedAt!: number;

  @Column({ type: DataType.BIGINT })
  updatedAt!: number;

  @Column
  createdBy!: string;

  @Column
  updatedBy!: string;

  @Column
  deletedBy!: string;

  @Column
  serverVersion!: number;
}
