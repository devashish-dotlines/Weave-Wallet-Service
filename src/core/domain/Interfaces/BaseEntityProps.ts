import { DateTimeObject } from '../../../modules/Core/domain/dateTimeObject';

export interface BaseEntityProps {
  voided?: boolean;
  serverVersion?: number;
  createdAt: DateTimeObject;
  updatedAt: DateTimeObject;
  deletedAt?: DateTimeObject;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string;
}
