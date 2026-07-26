import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export const USAGE_DATA_TYPES = [
  'integer',
  'decimal',
  'string',
  'boolean',
  'single_select',
  'multi_select',
] as const;
export type UsageDataType = (typeof USAGE_DATA_TYPES)[number];

/** An inline option: `key` is the stored/compared value, `value` the label. */
export interface UsageDimensionOption {
  key: string;
  value: string;
}

export function isNumericDataType(t: UsageDataType | string): boolean {
  return t === 'integer' || t === 'decimal';
}

export function isSelectDataType(t: UsageDataType | string): boolean {
  return t === 'single_select' || t === 'multi_select';
}

export interface UsageDimensionProps extends BaseEntityProps {
  name: string;
  /**
   * Unique machine key, lowercase (e.g. `call_type`, `bundle`). A spend-time
   * usage context is keyed by this, so it is IMMUTABLE after creation —
   * renaming it would silently detach every wallet restriction from the
   * contexts meant to match them.
   */
  key: string;
  description?: string;
  dataType: UsageDataType;
  /** Numeric types only. */
  minValue?: number | null;
  maxValue?: number | null;
  /** String type only — comma-separated allowed set. Absent ⇒ open. */
  allowedValues?: string | null;
  /** Select types only — the inline value list. */
  options: UsageDimensionOption[];
  isActive: boolean;
}

/**
 * An axis a wallet's balance can be restricted along, modelled on the Rate
 * Engine's `Variable` minus its variable-type grouping.
 *
 * A dimension either CONSTRAINS what it may hold (select options, a string's
 * allowed list, a boolean's two values) or is OPEN — in which case the value is
 * typed at wallet-creation time. `allowedKeys()` returns null for the open case,
 * which is the distinction the restriction validator turns on.
 *
 * Key uniqueness is a cross-record rule enforced in the use-case, not here.
 */
export class UsageDimension extends AuditableEntity<UsageDimensionProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get name(): string {
    return this.props.name;
  }
  get key(): string {
    return this.props.key;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get dataType(): UsageDataType {
    return this.props.dataType;
  }
  get minValue(): number | null {
    return this.props.minValue ?? null;
  }
  get maxValue(): number | null {
    return this.props.maxValue ?? null;
  }
  get allowedValues(): string | null {
    return this.props.allowedValues ?? null;
  }
  get options(): UsageDimensionOption[] {
    return this.props.options;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  /**
   * The values a restriction may tag, or **null when the dimension is open**
   * (any value is acceptable and is typed on the wallet screen).
   */
  public allowedKeys(): string[] | null {
    if (isSelectDataType(this.props.dataType)) {
      return this.props.options.map((o) => o.key);
    }
    if (this.props.dataType === 'boolean') return ['true', 'false'];
    if (this.props.dataType === 'string' && this.props.allowedValues) {
      const list = this.props.allowedValues
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return list.length > 0 ? list : null;
    }
    return null;
  }

  /** Open dimensions accept anything; constrained ones only their own values. */
  public permitsKey(key: string): boolean {
    const allowed = this.allowedKeys();
    if (allowed === null) return true;
    return allowed.includes(key);
  }

  /** Whether a value sits inside a numeric dimension's declared bounds. */
  public withinBounds(value: string): boolean {
    if (!isNumericDataType(this.props.dataType)) return true;
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (this.props.minValue != null && n < this.props.minValue) return false;
    if (this.props.maxValue != null && n > this.props.maxValue) return false;
    return true;
  }

  set name(value: string) {
    this.props.name = value;
  }
  set description(value: string | undefined) {
    this.props.description = value;
  }
  set isActive(value: boolean) {
    this.props.isActive = value;
  }

  private constructor(props: UsageDimensionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: UsageDimensionProps,
    id?: UniqueEntityID,
  ): Result<UsageDimension> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.key, argumentName: 'key' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<UsageDimension>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.isActive, argumentName: 'isActive' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<UsageDimension>(nn.message);

    const dt = Guard.isOneOf(
      props.dataType,
      USAGE_DATA_TYPES as unknown as any[],
      'dataType',
    );
    if (!dt.succeeded) return Result.fail<UsageDimension>(dt.message);

    const key = props.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return Result.fail<UsageDimension>(
        'key must be lowercase letters, digits and _ only, starting with a letter',
      );
    }

    const numeric = isNumericDataType(props.dataType);
    const select = isSelectDataType(props.dataType);

    // Drop constraints that don't apply to the chosen type, rather than
    // carrying misleading leftovers from an earlier edit.
    const minValue = numeric ? (props.minValue ?? null) : null;
    const maxValue = numeric ? (props.maxValue ?? null) : null;
    if (minValue != null && maxValue != null && minValue > maxValue) {
      return Result.fail<UsageDimension>('minValue must be ≤ maxValue');
    }
    const allowedValues =
      props.dataType === 'string' ? (props.allowedValues ?? null) : null;

    let options: UsageDimensionOption[] = [];
    if (select) {
      const seen = new Set<string>();
      for (const o of props.options ?? []) {
        const oKey = (o?.key ?? '').trim();
        const oValue = (o?.value ?? '').trim();
        if (!oKey) {
          return Result.fail<UsageDimension>('an option must have a key');
        }
        if (!oValue) {
          return Result.fail<UsageDimension>(`option "${oKey}" must have a label`);
        }
        if (seen.has(oKey)) {
          return Result.fail<UsageDimension>(`duplicate option key "${oKey}"`);
        }
        seen.add(oKey);
        options.push({ key: oKey, value: oValue });
      }
    }

    return Result.ok<UsageDimension>(
      new UsageDimension(
        { ...props, key, minValue, maxValue, allowedValues, options },
        id,
      ),
    );
  }
}
