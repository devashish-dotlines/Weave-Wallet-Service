import { status as GrpcStatus } from '@grpc/grpc-js';
import { BaseErrors } from '../../core/infra/BaseErrors';
import { GenericAppError } from '../../core/logic/AppError';

export interface GrpcError {
  code: GrpcStatus;
  message: string;
}

/**
 * gRPC mirror of `BaseController.handleUseCaseError` — maps a use-case Left
 * error instance to a gRPC status + message. Keep in sync with the REST mapping
 * (the constructor switch) as new error classes are introduced.
 */
export function toGrpcError(error: any): GrpcError {
  const message =
    typeof error?.errorValue === 'function'
      ? error.errorValue().message
      : String(error?.message ?? error);

  switch (error?.constructor) {
    case BaseErrors.ValidationError:
      return { code: GrpcStatus.INVALID_ARGUMENT, message };

    case BaseErrors.AlreadyExistError:
    case BaseErrors.ConflictError:
      return { code: GrpcStatus.ALREADY_EXISTS, message };

    case BaseErrors.NotAuthorizedError:
      return { code: GrpcStatus.PERMISSION_DENIED, message };

    case BaseErrors.NotFoundError:
      return { code: GrpcStatus.NOT_FOUND, message };

    case BaseErrors.BusinessRuleError:
      return { code: GrpcStatus.FAILED_PRECONDITION, message };

    case BaseErrors.GenericError:
    case GenericAppError.UnexpectedError:
    default:
      return { code: GrpcStatus.INTERNAL, message };
  }
}
