import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export const USAGE_OPERATORS = ['eq', 'neq', 'in', 'not_in'] as const;
export type UsageOperator = (typeof USAGE_OPERATORS)[number];

/** eq/neq compare a single value; in/not_in compare against a set. */
export function isSingleValueOperator(op: UsageOperator): boolean {
  return op === 'eq' || op === 'neq';
}

export interface WalletUsageRestrictionProps extends BaseEntityProps {
  walletId: string;
  usageDimensionId: string;
  operator: UsageOperator;
  /** Dimension-value CODES, upper-cased. Never empty — see create(). */
  valueKeys: string[];
  /** Reserved: AND within a group, OR across groups. Everything ships as 0. */
  groupNo: number;
}

/**
 * One restriction on one wallet along one usage dimension: this balance may be
 * spent only when the usage context matches.
 *
 * `not_in` is not redundant with `in` over a closed set: `not_in [PEAK]` keeps
 * covering a band added next month, whereas `in [OFF_PEAK, NIGHT]` silently
 * won't. Keep both.
 */
export class WalletUsageRestriction extends AuditableEntity<WalletUsageRestrictionProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get walletId(): string {
    return this.props.walletId;
  }
  get usageDimensionId(): string {
    return this.props.usageDimensionId;
  }
  get operator(): UsageOperator {
    return this.props.operator;
  }
  get valueKeys(): string[] {
    return this.props.valueKeys;
  }
  get groupNo(): number {
    return this.props.groupNo;
  }

  private constructor(
    props: WalletUsageRestrictionProps,
    id?: UniqueEntityID,
  ) {
    super(props, id);
  }

  public static create(
    props: WalletUsageRestrictionProps,
    id?: UniqueEntityID,
  ): Result<WalletUsageRestriction> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.walletId, argumentName: 'walletId' },
      { argument: props.usageDimensionId, argumentName: 'usageDimensionId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) {
      return Result.fail<WalletUsageRestriction>(guard.message);
    }

    const op = Guard.isOneOf(
      props.operator,
      USAGE_OPERATORS as unknown as any[],
      'operator',
    );
    if (!op.succeeded) return Result.fail<WalletUsageRestriction>(op.message);

    if (!Array.isArray(props.valueKeys)) {
      return Result.fail<WalletUsageRestriction>('valueKeys must be an array');
    }
    // Values are compared verbatim against the dimension's own keys, so case is
    // preserved — a select option key is whatever the admin typed.
    const valueKeys = [
      ...new Set(props.valueKeys.map((k) => (k ?? '').trim()).filter(Boolean)),
    ];
    // `in []` and `not_in []` are both ambiguous. "Unrestricted" is expressed by
    // the ABSENCE of a row, never by an empty one.
    if (valueKeys.length === 0) {
      return Result.fail<WalletUsageRestriction>(
        'a restriction must tag at least one value — delete the row to lift it',
      );
    }

    const groupNo = Number.isFinite(props.groupNo) ? props.groupNo : 0;

    return Result.ok<WalletUsageRestriction>(
      new WalletUsageRestriction({ ...props, valueKeys, groupNo }, id),
    );
  }
}
