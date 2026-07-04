import { Either, Result } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';

/**
 * The Either every Wallet use-case returns: a left error (a `BaseErrors.*` or the
 * catch-all UnexpectedError) or a right success wrapping a `Result<T>`.
 */
export type WalletResponse<T> = Either<
  BaseErrors.AllErrors | GenericAppError.UnexpectedError,
  Result<T>
>;
