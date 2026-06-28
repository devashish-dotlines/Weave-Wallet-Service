import { ValueObject } from '../../../core/domain/ValueObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

interface PhoneNoProps {
  value: string;
}

export class PhoneNo extends ValueObject<PhoneNoProps> {
  get value(): string {
    return this.props.value;
  }

  private constructor(props: PhoneNoProps) {
    super(props);
  }

  public static create(valueString: string): Result<PhoneNo> {
    const guardResultvalue_1 = Guard.againstNullOrUndefined(
      valueString,
      'value',
    );
    if (!guardResultvalue_1.succeeded) {
      return Result.fail<PhoneNo>(guardResultvalue_1.message);
    }

    const phoneNo = new PhoneNo({ value: valueString });
    return Result.ok<PhoneNo>(phoneNo);
  }
}
