import {
  Model,
  Column,
  Table,
  Default,
  DataType,
  IsUUID,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { TopupRequest } from './topupRequest';

@Table({
  tableName: 'wlt_topup_request_attachment',
  underscored: true,
  timestamps: false,
  indexes: [
    { name: 'idx_wlt_topup_attachment_request', fields: ['topup_request_id'] },
  ],
})
export class TopupRequestAttachment extends Model<TopupRequestAttachment> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => TopupRequest)
  @Column(DataType.UUID)
  topupRequestId!: string;

  @BelongsTo(() => TopupRequest)
  topupRequest!: TopupRequest;

  @Column({ type: DataType.STRING(120) })
  originalFilename!: string;

  // 'local' | 's3'
  @Column({ type: DataType.STRING(8) })
  storageDriver!: string;

  @Column({ type: DataType.STRING(512) })
  storageKey!: string;

  @Column({ type: DataType.STRING(100) })
  contentType!: string;

  @Column({ type: DataType.INTEGER })
  sizeBytes!: number;

  @Column({ type: DataType.STRING(64) })
  checksumSha256!: string;

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
