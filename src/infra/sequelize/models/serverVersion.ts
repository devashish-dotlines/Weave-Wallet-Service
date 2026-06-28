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
  AutoIncrement,
} from 'sequelize-typescript';

@Table({ tableName: 'server_version', underscored: true, timestamps: false })
export class ServerVersion extends Model<ServerVersion> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT })
  id!: number;
}
