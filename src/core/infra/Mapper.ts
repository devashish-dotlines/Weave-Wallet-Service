import { DateTimeObject } from '../../modules/Core/domain/dateTimeObject';

export abstract class Mapper<DomainEntityOrValueObject> {
  // public static toDomain (raw: any): T;
  // public static toDTO (t: T): DTO;
  // public static toPersistence (t: T): any;

  public static toDateRequired(
    raw: number,
    field: string,
    entity: string,
  ): DateTimeObject {
    const result = DateTimeObject.create(raw);
    if (result.isFailure) {
      throw new Error(`Error parsing ${field} for ${entity}`);
    }
    return result.getValue();
  }

  public static toDateOptional(
    raw: number | null | undefined,
  ): DateTimeObject | undefined {
    if (raw === null || raw === undefined) return undefined;
    return DateTimeObject.create(raw).getValue();
  }
}
