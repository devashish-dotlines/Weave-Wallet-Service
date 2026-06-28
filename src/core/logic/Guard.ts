import moment from 'moment';
export interface IGuardResult {
  succeeded: boolean;
  message?: string;
}

export interface IGuardArgument {
  argument: any;
  argumentName: string;
}

export type GuardArgumentCollection = IGuardArgument[];

export class Guard {
  public static combine(guardResults: IGuardResult[]): IGuardResult {
    for (let result of guardResults) {
      if (result.succeeded === false) return result;
    }

    return { succeeded: true };
  }

  public static againstNullOrUndefinedOrEmpty(
    argument: any,
    argumentName: string,
  ): IGuardResult {
    if (argument === null || argument === undefined || argument === '') {
      return {
        succeeded: false,
        message: `${argumentName} is null or undefined or empty`,
      };
    } else {
      return { succeeded: true };
    }
  }

  public static againstNullOrUndefinedOrEmptyBulk(
    args: GuardArgumentCollection,
  ): IGuardResult {
    for (let arg of args) {
      const result = this.againstNullOrUndefinedOrEmpty(
        arg.argument,
        arg.argumentName,
      );
      if (!result.succeeded) return result;
    }

    return { succeeded: true };
  }

  public static againstNullOrUndefined(
    argument: any,
    argumentName: string,
  ): IGuardResult {
    if (argument === null || argument === undefined) {
      return {
        succeeded: false,
        message: `${argumentName} is null or undefined`,
      };
    } else {
      return { succeeded: true };
    }
  }

  public static againstNullOrUndefinedBulk(
    args: GuardArgumentCollection,
  ): IGuardResult {
    for (let arg of args) {
      const result = this.againstNullOrUndefined(
        arg.argument,
        arg.argumentName,
      );
      if (!result.succeeded) return result;
    }

    return { succeeded: true };
  }

  public static isOneOf(
    value: any,
    validValues: any[],
    argumentName: string,
  ): IGuardResult {
    let isValid = false;
    for (let validValue of validValues) {
      if (value === validValue) {
        isValid = true;
      }
    }

    if (isValid) {
      return { succeeded: true };
    } else {
      return {
        succeeded: false,
        message: `${argumentName} isn't oneOf the correct types in ${JSON.stringify(
          validValues,
        )}. Got "${value}".`,
      };
    }
  }

  public static inRange(
    num: number,
    min: number,
    max: number,
    argumentName: string,
  ): IGuardResult {
    const isInRange = num >= min && num <= max;
    if (!isInRange) {
      return {
        succeeded: false,
        message: `${argumentName} is not within range ${min} to ${max}.`,
      };
    } else {
      return { succeeded: true };
    }
  }

  public static isGreaterThan(
    num: number,
    min: number,
    argumentName: string,
  ): IGuardResult {
    const isGreaterThan = num > min;
    if (!isGreaterThan) {
      return {
        succeeded: false,
        message: `${argumentName} must be greather than ${min}.`,
      };
    } else {
      return { succeeded: true };
    }
  }

  public static isValidDate(
    argument: string,
    argumentName: string,
  ): IGuardResult {
    if (argument === null || argument === undefined) {
      return {
        succeeded: false,
        message: `${argumentName} is null or undefined. Its not a valid date format`,
      };
    }
    const isValidDate = moment(argument, 'YYYY-MM-DD', true).isValid();
    if (!isValidDate) {
      return {
        succeeded: false,
        message: `${argumentName} is not a valid date.`,
      };
    } else {
      return { succeeded: true };
    }
  }

  public static isValidTimeString(
    argument: string,
    argumentName: string,
  ): IGuardResult {
    if (argument === null || argument === undefined) {
      return {
        succeeded: false,
        message: `${argumentName} is null or undefined. Its not a valid time format`,
      };
    }
    const timePattern = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

    if (timePattern.test(argument)) {
      // Split the time string into hour and minute parts
      const [hour, minute] = argument.split(':');

      // Convert hour and minute to numbers
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);

      // Check if hour is between 0 and 23 and minute is between 0 and 59
      if (hourNum >= 0 && hourNum <= 23 && minuteNum >= 0 && minuteNum <= 59) {
        return { succeeded: true };
      }
    }
    return {
      succeeded: false,
      message: `${argumentName} is not a valid time format.`,
    };
  }

  public static allInRange(
    numbers: number[],
    min: number,
    max: number,
    argumentName: string,
  ): IGuardResult {
    let failingResult: IGuardResult | null = null;
    for (let num of numbers) {
      const numIsInRangeResult = this.inRange(num, min, max, argumentName);
      if (!numIsInRangeResult.succeeded) failingResult = numIsInRangeResult;
    }

    if (failingResult) {
      return {
        succeeded: false,
        message: `${argumentName} is not within the range.`,
      };
    } else {
      return { succeeded: true };
    }
  }
}
