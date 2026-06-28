import { ValueObject } from '../../../core/domain/ValueObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  get value(): string {
    return this.props.value;
  }

  private constructor(props: EmailProps) {
    super(props);
  }

  public static create(valueString: string): Result<Email> {
    const guardResultvalue_1 = Guard.againstNullOrUndefined(
      valueString,
      'value',
    );
    if (!guardResultvalue_1.succeeded) {
      return Result.fail<Email>(guardResultvalue_1.message);
    }

    const email = new Email({ value: valueString });
    return Result.ok<Email>(email);
  }
}
