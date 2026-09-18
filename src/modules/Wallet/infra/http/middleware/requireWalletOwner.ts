import * as express from 'express';
import { walletRepo } from '../../../repos';
import { walletOwnership } from '../../../services';
import { OwnershipUnavailableError } from '../../../services/walletOwnership.service';

function deny(res: express.Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

/**
 * Gates a self-service route on the caller owning the wallet named by
 * `req.params[paramName]`. Mounted after `Auth.authenticateGateway` and the
 * route's `requirePermission(...)`. A wallet the caller doesn't own answers 404,
 * not 403, so wallet ids can't be probed for existence.
 */
export function requireWalletOwner(paramName = 'walletId'): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const walletId = req.params[paramName];
      const wallet = walletId ? await walletRepo.findById(walletId) : null;
      if (!wallet) return deny(res, 404, 'NOT_FOUND', 'Wallet not found');

      const owns = await walletOwnership.owns(req.user?.id ?? '', wallet);
      if (!owns) return deny(res, 404, 'NOT_FOUND', 'Wallet not found');
      return next();
    } catch (err) {
      if (err instanceof OwnershipUnavailableError) {
        console.error('[wallet-ownership]', err.message);
        return deny(
          res,
          503,
          'OWNERSHIP_UNAVAILABLE',
          'Wallet ownership cannot be verified right now',
        );
      }
      return next(err);
    }
  };
}
