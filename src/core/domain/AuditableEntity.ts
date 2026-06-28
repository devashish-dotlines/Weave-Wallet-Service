import { Entity } from './Entity';
import { BaseEntityProps } from './Interfaces/BaseEntityProps';
import { DateTimeObject } from '../../modules/Core/domain/dateTimeObject';

export abstract class AuditableEntity<
  T extends BaseEntityProps,
> extends Entity<T> {
  public get voided(): boolean | undefined {
    return this.props.voided;
  }

  public set voided(value: boolean | undefined) {
    this.props.voided = value;
  }

  public get serverVersion(): number | undefined {
    return this.props.serverVersion;
  }

  public set serverVersion(value: number | undefined) {
    this.props.serverVersion = value;
  }

  public get createdAt(): DateTimeObject {
    return this.props.createdAt;
  }

  public set createdAt(value: DateTimeObject) {
    this.props.createdAt = value;
  }

  public get updatedAt(): DateTimeObject {
    return this.props.updatedAt;
  }

  public set updatedAt(value: DateTimeObject) {
    this.props.updatedAt = value;
  }

  public get deletedAt(): DateTimeObject | undefined {
    return this.props.deletedAt;
  }

  public set deletedAt(value: DateTimeObject | undefined) {
    this.props.deletedAt = value;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public set createdBy(value: string) {
    this.props.createdBy = value;
  }

  public get updatedBy(): string {
    return this.props.updatedBy;
  }

  public set updatedBy(value: string) {
    this.props.updatedBy = value;
  }

  public get deletedBy(): string | undefined {
    return this.props.deletedBy;
  }

  public set deletedBy(value: string | undefined) {
    this.props.deletedBy = value;
  }
}
