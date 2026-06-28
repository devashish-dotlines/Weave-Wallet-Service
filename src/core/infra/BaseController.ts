import * as express from 'express';
import { GenericAppError } from '../logic/AppError';
import { BaseErrors } from './BaseErrors';
import { Either, Result } from '../logic/Result';

export abstract class BaseController {
  // or even private
  // protected req!: express.Request;
  // protected res!: express.Response;

  protected abstract executeImpl(
    req: express.Request,
    res: express.Response,
  ): Promise<void | any>;

  public execute(req: express.Request, res: express.Response): void {
    this.executeImpl(req, res);
  }

  protected handleDeleteOrRestore(
    res: express.Response,
    result: Either<Result<any>, Result<void>>,
    message: string = 'Updated successfully',
  ) {
    if (result.isRight()) {
      return this.noContent(res, message);
    } else if (result.isLeft()) {
      const error = result.value;
      return this.handleUseCaseError(res, error);
    } else {
      return this.ok(res);
    }
  }

  protected handleUseCaseError(res: express.Response, error: any) {
    switch (error.constructor) {
      case BaseErrors.ValidationError:
        return this.clientError(res, error.errorValue().message);

      case BaseErrors.AlreadyExistError:
        return this.forbidden(res, error.errorValue().message);

      case BaseErrors.NotAuthorizedError:
        return this.forbidden(res, error.errorValue().message);

      case BaseErrors.NotFoundError:
        return this.notFound(res, error.errorValue().message);

      case BaseErrors.BusinessRuleError:
        return this.unprocessable(res, error.errorValue().message);

      case BaseErrors.ConflictError:
        return this.conflict(res, error.errorValue().message);

      case BaseErrors.IdpError:
        return this.badGateway(res, error.errorValue().message);

      case BaseErrors.GenericError:
      case GenericAppError.UnexpectedError:
        return this.fail(res, error.errorValue().message);

      default:
        return this.fail(res, error);
    }
  }

  // protected abstract executeUseCase(dto: any): Promise<any>;

  // public static jsonResponse(
  public jsonResponse(res: express.Response, code: number, message: string) {
    return res.status(code).json({ message });
  }

  public ok<T>(res: express.Response, dto?: T) {
    if (!!dto) {
      return res.status(200).json(dto);
    } else {
      return res.sendStatus(200);
    }
  }

  public created<T>(res: express.Response, dto?: T) {
    if (!!dto) {
      return res.status(201).json(dto);
    } else {
      return res.sendStatus(201);
    }
  }

  // public created(res: express.Response) {
  //   return res.sendStatus(201);
  // }

  public accepted<T>(res: express.Response, dto?: T) {
    if (!!dto) {
      return res.status(202).json(dto);
    } else {
      return res.sendStatus(202);
    }
  }

  public clientError(res: express.Response, message?: string) {
    return this.jsonResponse(res, 400, message ?? 'Unauthorized');
  }

  public noContent(res: express.Response, message?: string) {
    return res.status(204).json({
      message: message ?? 'No content available',
    });
  }

  public unauthorized(res: express.Response, message?: string) {
    return this.jsonResponse(res, 401, message ?? 'Unauthorized');
  }

  public paymentRequired(res: express.Response, message?: string) {
    return this.jsonResponse(res, 402, message ?? 'Payment required');
  }

  public forbidden(res: express.Response, message?: string) {
    return this.jsonResponse(res, 403, message ?? 'Forbidden');
  }

  public notFound(res: express.Response, message?: string) {
    return this.jsonResponse(res, 404, message ?? 'Not found');
  }

  public conflict(res: express.Response, message: string) {
    return this.jsonResponse(res, 409, message ?? 'Conflict');
  }

  public unprocessable(res: express.Response, message?: string) {
    return this.jsonResponse(res, 422, message ?? 'Unprocessable entity');
  }

  public tooMany(res: express.Response, message?: string) {
    return this.jsonResponse(res, 429, message ?? 'Too many requests');
  }

  public badGateway(res: express.Response, message?: string) {
    return this.jsonResponse(res, 502, message ?? 'Bad gateway');
  }

  public todo(res: express.Response) {
    return this.jsonResponse(res, 400, 'TODO');
  }

  public fail(res: express.Response, error: Error | string) {
    try {
      if (!res.headersSent) {
        return res.status(500).json({
          message: error.toString(),
        });
      }
    } catch (err) {
      // response already sent; nothing more we can do
    }
  }
}
