import * as grpc from '@grpc/grpc-js';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { WorkflowEngineError } from '../../../../infra/workflow';

/** Translate a workflow-engine failure into the wallet's HTTP-mapped errors. */
export function toWalletWorkflowError(err: WorkflowEngineError): BaseErrors.AllErrors {
  switch (err.grpcCode) {
    case grpc.status.NOT_FOUND:
      return new BaseErrors.NotFoundError(err.message);
    case grpc.status.PERMISSION_DENIED:
    case grpc.status.UNAUTHENTICATED:
      return new BaseErrors.NotAuthorizedError(err.message);
    case grpc.status.ALREADY_EXISTS:
    case grpc.status.ABORTED:
      return new BaseErrors.ConflictError(err.message);
    case grpc.status.INVALID_ARGUMENT:
    case grpc.status.FAILED_PRECONDITION:
      return new BaseErrors.BusinessRuleError(err.message);
    default:
      return new BaseErrors.GenericError(
        `Approval workflow is unavailable: ${err.message}`,
      );
  }
}
