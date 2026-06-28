import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

export class Crypto {
  public static generateApiKey(): string {
    return randomBytes(16).toString('hex');
  }

  public static generateClientSecret(): string {
    return randomBytes(32).toString('hex');
  }

  public static async hashSecret(secret: string): Promise<string> {
    return await bcrypt.hash(secret, 10);
  }

  public static async compareSecret(
    secret: string,
    hash: string,
  ): Promise<boolean> {
    return await bcrypt.compare(secret, hash);
  }
}
