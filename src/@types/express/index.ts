import { IUser } from '../../core/interface/iuser';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
