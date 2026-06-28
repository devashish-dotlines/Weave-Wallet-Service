import express from 'express';
import cors from 'cors';
import { Auth } from '../../../core/middleware/auth';

import { coreRouter } from '../../../modules/Core/infra/http/routes';

const v1Router = express.Router();
v1Router.use(cors());

// Unauthenticated infrastructure routes (health probe, etc.).
v1Router.use('/v1', coreRouter);

// Mount new module routers here. Every request arrives THROUGH APISix, which has
// already verified the token against Keycloak — we only DECODE it here
// (Auth.authenticateGateway), never re-verify. Gate individual config routes
// with requirePermission(...) inside the module router. e.g.:
// v1Router.use('/v1/<module>', Auth.authenticateGateway, <module>Router);
void Auth;

export { v1Router };
