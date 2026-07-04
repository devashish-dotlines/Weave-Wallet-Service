import express from 'express';
import cors from 'cors';
import { Auth } from '../../../core/middleware/auth';

import { coreRouter } from '../../../modules/Core/infra/http/routes';
import { walletRouter } from '../../../modules/Wallet/infra/http/route';

const v1Router = express.Router();
v1Router.use(cors());

// Unauthenticated infrastructure routes (health probe, etc.).
v1Router.use('/v1', coreRouter);

// Wallet module. Every request arrives THROUGH APISix, which has already
// verified the token against Keycloak — we only DECODE it here
// (Auth.authenticateGateway), never re-verify. Individual routes are gated with
// requirePermission(...) inside the module router.
// Mount new module routers here following the same pattern.
v1Router.use('/v1/wallet', Auth.authenticateGateway, walletRouter);

export { v1Router };
