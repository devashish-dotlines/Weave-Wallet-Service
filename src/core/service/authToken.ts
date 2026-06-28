import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '../interface/iuser';
import { config } from '../../config/index';

export class AuthToken {
  // life in hour
  public static generateToken(payload: any, life: number): string {
    const token = jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: `${life}h`,
    });

    return token;
  }

  public static verifyToken(token: string): string {
    const decoded: JwtPayload = jwt.verify(
      token,
      config.auth.jwtSecret,
    ) as JwtPayload;

    return decoded.id as unknown as string;
  }

  public static generateAPIKey(payload: any, life: number): string {
    const token = jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: `${life}h`,
    });
    return token;
  }

  public static verifyAPIKey(token: string): IUser {
    const decoded: JwtPayload = jwt.verify(
      token,
      config.auth.jwtSecret,
    ) as JwtPayload;
    const user: IUser = decoded.user as IUser;
    user.accountId = parseInt(decoded.accountId as unknown as string, 10);
    return user;
  }
}
