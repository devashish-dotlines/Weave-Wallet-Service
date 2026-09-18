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
import { BalanceType } from './balanceType';

/**
 * Units a balance type may be denominated in, all from the balance type's
 * category. `unit_id` is an acc_currency id for a CURRENCY category and a
 * wlt_uom id for a LOCAL one, so it carries no FK — the UnitRegistry resolves
 * it against the category's source. No live rows ⇒ any unit of the category.
 *
 * Replaces wlt_balance_type_uom (kept in the DB for the unit-category
 * migration, no longer read by the app).
 */
@Table({
  tableName: 'wlt_balance_type_unit',
  underscored: true,
  timestamps: false,
  indexes: [
    // Rows are revived rather than re-inserted, so the pair stays unique.
    {
      name: 'uq_wlt_balance_type_unit',
      unique: true,
      fields: ['balance_type_id', 'unit_id'],
    },
  ],
})
export class BalanceTypeUnit extends Model<BalanceTypeUnit> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => BalanceType)
  @Column(DataType.UUID)
  balanceTypeId!: string;

  @Column(DataType.UUID)
  unitId!: string;

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
