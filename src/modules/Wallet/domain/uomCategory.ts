import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

/** Where a category's units live. New sources are added here. */
export type UnitSource = 'ACCOUNTING_CURRENCY' | 'LOCAL';
export const UNIT_SOURCES: UnitSource[] = ['ACCOUNTING_CURRENCY', 'LOCAL'];

/** Balances are DECIMAL(18,2), so no category may allow more than 2. */
export const MAX_UNIT_DECIMALS = 2;

export interface UomCategoryProps extends BaseEntityProps {
  /** CURRENCY, POINTS, TIME, DATA … upper-cased, immutable. */
  code: string;
  name: string;
  unitSource: UnitSource;
  /** Has a money value: can be priced, topped up and posted to the GL. */
  valued: boolean;
  /** Max decimals an amount may carry. */
  decimals: number;
  /** LOCAL only: the unit whose factor is 1. */
  baseUomId?: string;
  isActive: boolean;
}

/**
 * The kind of unit a balance holds. A balance type belongs to exactly one
 * category, and every wallet of it holds a unit of that category. The category
 * decides where unit ids point (accounting currencies or wallet UOMs), whether
 * the units have a money value, and how many decimals an amount may carry.
 */
export class UomCategory extends AuditableEntity<UomCategoryProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get unitSource(): UnitSource {
    return this.props.unitSource;
  }
  get valued(): boolean {
    return this.props.valued;
  }
  get decimals(): number {
    return this.props.decimals;
  }
  get baseUomId(): string | undefined {
    return this.props.baseUomId;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get isLocal(): boolean {
    return this.props.unitSource === 'LOCAL';
  }

  set name(value: string) {
    this.props.name = value;
  }
  set valued(value: boolean) {
    this.props.valued = value;
  }
  set decimals(value: number) {
    this.props.decimals = value;
  }
  set baseUomId(value: string | undefined) {
    this.props.baseUomId = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
  }

  private constructor(props: UomCategoryProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: UomCategoryProps,
    id?: UniqueEntityID,
  ): Result<UomCategory> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.code, argumentName: 'code' },
      { argument: props.name, argumentName: 'name' },
      { argument: props.unitSource, argumentName: 'unitSource' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<UomCategory>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.valued, argumentName: 'valued' },
      { argument: props.decimals, argumentName: 'decimals' },
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<UomCategory>(nn.message);

    const sourceOk = Guard.isOneOf(props.unitSource, UNIT_SOURCES, 'unitSource');
    if (!sourceOk.succeeded) return Result.fail<UomCategory>(sourceOk.message);

    if (
      !Number.isInteger(props.decimals) ||
      props.decimals < 0 ||
      props.decimals > MAX_UNIT_DECIMALS
    ) {
      return Result.fail<UomCategory>(
        `decimals must be a whole number from 0 to ${MAX_UNIT_DECIMALS}`,
      );
    }
    // Currencies carry their own value in Accounting; there is no base unit
    // among them to factor against.
    if (props.unitSource !== 'LOCAL' && props.baseUomId) {
      return Result.fail<UomCategory>('Only a LOCAL category has a base unit');
    }

    const code = props.code.trim().toUpperCase();
    if (!/^[A-Z0-9_]+$/.test(code)) {
      return Result.fail<UomCategory>('code may contain only A–Z, 0–9 and _');
    }

    return Result.ok<UomCategory>(new UomCategory({ ...props, code }, id));
  }
}
