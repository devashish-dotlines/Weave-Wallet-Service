import { UseCaseError } from '../logic/UseCaseError';
import { Result } from '../logic/Result';

export namespace BaseErrors {
  class AppError extends Result<UseCaseError> {
    constructor(message: string) {
      super(false, {
        message: `${message}`,
      } as UseCaseError);
    }
  }

  export class ValidationError extends AppError {
    constructor(err: string = 'Validation failed') {
      super(err);
    }
  }

  export class NotAuthorizedError extends AppError {
    constructor(err: string = 'Permission denied') {
      super(err);
    }
  }

  export class AuthenticationFailed extends Result<UseCaseError> {
    constructor() {
      super(false, {
        message: 'Invalid username or password',
      } as UseCaseError);
    }
  }

  export class NotFoundError extends AppError {
    constructor(err: string = 'Resource not found') {
      super(err);
    }
  }

  export class AlreadyExistError extends AppError {
    constructor(err: string = 'Already exists') {
      super(err);
    }
  }

  export class GenericError extends AppError {
    constructor(err: string = 'Unknown error') {
      super(err);
    }
  }

  /** Domain/business-rule violation that is well-formed but not permitted (HTTP 422). */
  export class BusinessRuleError extends AppError {
    constructor(err: string = 'Business rule violation') {
      super(err);
    }
  }

  /** A write conflicts with current state, e.g. duplicate / version clash (HTTP 409). */
  export class ConflictError extends AppError {
    constructor(err: string = 'Conflict') {
      super(err);
    }
  }

  /** Upstream Identity Provider (Keycloak) failure during write-through (HTTP 502). */
  export class IdpError extends AppError {
    constructor(err: string = 'Identity provider error') {
      super(err);
    }
  }

  export type AllErrors =
    | ValidationError
    | NotAuthorizedError
    | AuthenticationFailed
    | AlreadyExistError
    | NotFoundError
    | GenericError
    | BusinessRuleError
    | ConflictError
    | IdpError;
}
