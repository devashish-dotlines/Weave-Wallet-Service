import * as express from 'express';
export interface UseCase<IRequest, IResponse> {
  execute(
    request?: IRequest,
    req?: express.Request,
    res?: express.Response,
  ): Promise<IResponse> | IResponse;
}
