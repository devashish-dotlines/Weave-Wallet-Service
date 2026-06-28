import { ValueObject } from '../../../core/domain/ValueObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

interface TimeStringProps {
  value: string;
}

export class TimeString extends ValueObject<TimeStringProps> {
  get value(): string {
    return this.props.value;
  }

  private constructor(props: TimeStringProps) {
    super(props);
  }

  public static create(valueString: string): Result<TimeString> {
    const guardResultvalue_1 = Guard.againstNullOrUndefined(
      valueString,
      'value',
    );
    if (!guardResultvalue_1.succeeded) {
      return Result.fail<TimeString>(guardResultvalue_1.message);
    }

    const timeString = new TimeString({ value: valueString });
    return Result.ok<TimeString>(timeString);
  }
}
