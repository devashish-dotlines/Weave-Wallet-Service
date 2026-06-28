import { ValueObject } from '../../../core/domain/ValueObject';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

import * as moment from 'moment-timezone';

interface DateTimeObjectProps {
  value: number;
}

export class DateTimeObject extends ValueObject<DateTimeObjectProps> {
  get value(): number {
    return this.props.value;
  }

  private constructor(props: DateTimeObjectProps) {
    super(props);
  }

  public toFormattedString(
    timeZone: string | undefined = 'Asia/Dhaka',
  ): string {
    const unixTimestamp: number = this.props.value;
    // Create a moment object from the Unix timestamp (in milliseconds)
    // const date = moment.unix(unixTimestamp / 1000).utc().tz(); //(unixTimestamp);
    const date = moment.unix(unixTimestamp);
    const timeZoneDate = date.tz(timeZone);

    // Format the date according to the desired format (e.g., 'YYYY-MM-DD HH:mm:ss')
    const formattedDate = timeZoneDate.format('YYYY-MM-DD HH:mm:ss');

    return formattedDate;
  }

  public static create(valueString: number): Result<DateTimeObject> {
    const timeZone: string = 'Asia/Dhaka';
    if (valueString === -1) {
      const date = moment.tz(timeZone);
      valueString = date.unix();
      // valueString = new Date().getTime();
    }

    const guardResultvalue_1 = Guard.againstNullOrUndefined(
      valueString,
      'value',
    );

    if (!guardResultvalue_1.succeeded) {
      return Result.fail<DateTimeObject>(guardResultvalue_1.message);
    }

    const dateObject = new DateTimeObject({ value: valueString });
    return Result.ok<DateTimeObject>(dateObject);
  }

  public static createFromDateTimeString(
    dateStringValue: string | undefined = '',
    timeZone: string | undefined = 'Asia/Dhaka',
  ): Result<DateTimeObject> {
    if (dateStringValue === '') {
      return DateTimeObject.create(-1);
    } else {
      const formatString = 'YYYY-MM-DD HH:mm:ss';

      const date = moment.tz(dateStringValue, formatString, timeZone);
      const unixTimestamp = date.unix();
      return DateTimeObject.create(unixTimestamp);
    }
  }
}
