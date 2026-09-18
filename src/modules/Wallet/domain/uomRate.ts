import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { DateTimeObject } from '../../Core/domain/dateTimeObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export interface UomRateProps extends BaseEntityProps {
  uomId: string;
  /** Base-currency amount one unit of the UOM is worth. */
  baseValue: number;
  effectiveFrom: DateTimeObject;
  /** Inclusive end; absent means open-ended. */
  effectiveTo?: DateTimeObject;
  note?: string;
}

/**
 * An effective-dated price for one wallet unit, quoted in the accounting base
 * currency, valid over [effectiveFrom, effectiveTo]. An absent `effectiveTo`
 * means open-ended. Windows for one UOM may not overlap, so exactly one rate
 * applies at any moment.
 */
export class UomRate extends AuditableEntity<UomRateProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get uomId(): string {
    return this.props.uomId;
  }
  get baseValue(): number {
    return this.props.baseValue;
  }
  get effectiveFrom(): DateTimeObject {
    return this.props.effectiveFrom;
  }
  get effectiveTo(): DateTimeObject | undefined {
    return this.props.effectiveTo;
  }

  /** True when `atSeconds` falls inside this rate's window. */
  public coversMoment(atSeconds: number): boolean {
    if (atSeconds < this.props.effectiveFrom.value) return false;
    const to = this.props.effectiveTo?.value;
    return to === undefined || atSeconds <= to;
  }

  /** Close an open-ended window so a successor can start after it. */
  public closeAt(endSeconds: DateTimeObject, by: string, at: DateTimeObject): Result<void> {
    if (endSeconds.value < this.props.effectiveFrom.value) {
      return Result.fail<void>('A rate cannot end before it starts');
    }
    this.props.effectiveTo = endSeconds;
    this.props.updatedBy = by;
    this.props.updatedAt = at;
    return Result.ok<void>();
  }
  get note(): string | undefined {
    return this.props.note;
  }

  private constructor(props: UomRateProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: UomRateProps,
    id?: UniqueEntityID,
  ): Result<UomRate> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.uomId, argumentName: 'uomId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<UomRate>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.baseValue, argumentName: 'baseValue' },
      { argument: props.effectiveFrom, argumentName: 'effectiveFrom' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<UomRate>(nn.message);

    if (
      typeof props.baseValue !== 'number' ||
      !Number.isFinite(props.baseValue) ||
      !(props.baseValue > 0)
    ) {
      return Result.fail<UomRate>('baseValue must be a number greater than 0');
    }
    if (
      props.effectiveTo &&
      props.effectiveTo.value < props.effectiveFrom.value
    ) {
      return Result.fail<UomRate>('effectiveTo cannot be before effectiveFrom');
    }
    if (props.note !== undefined && props.note.length > 500) {
      return Result.fail<UomRate>('note must be at most 500 characters');
    }

    return Result.ok<UomRate>(new UomRate(props, id));
  }
}
