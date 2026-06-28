import { ValueObject } from '../../../core/domain/ValueObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';
import * as bcrypt from 'bcryptjs';

interface PasswordProps {
  value: string;
}

export class Password extends ValueObject<PasswordProps> {
  get value(): string {
    return this.props.value;
  }

  private constructor(props: PasswordProps) {
    super(props);
  }

  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // You can adjust the number of salt rounds for security
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }

  public static async create(
    valueString: string,
    needHash: boolean = false,
  ): Promise<Result<Password>> {
    const guardResultvalue_1 = Guard.againstNullOrUndefined(
      valueString,
      'value',
    );
    if (!guardResultvalue_1.succeeded) {
      return Result.fail<Password>(guardResultvalue_1.message);
    }

    if (needHash) {
      valueString = await Password.hashPassword(valueString);
    }

    const password = new Password({ value: valueString });
    return Result.ok<Password>(password);
  }
}
