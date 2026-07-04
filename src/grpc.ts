require('dotenv').config();

// Load Sequelize models and (transitively, via the Wallet repos) the state the
// gRPC handlers depend on. Express is NOT started here — the gRPC server runs as
// its own process (`npm run grpc`).
import './infra/sequelize';
import './modules/Wallet/repos';
import { Auth } from './core/middleware/auth';
import { AuthToken } from './core/service/authToken';
import { registerWalletWorkflowEntities } from './modules/Wallet/infra/workflow/registerEntities';
import { startGrpcServer } from './infra/grpc/server';

// Service-to-service auth for inbound gRPC (the EntityStatus push from the
// engine). Resolve the caller from its HMAC-signed service API key (the same
// primitive REST `authenticateAPIKey` accepts). Fail-closed: an invalid key
// resolves to null.
Auth.moduleApiKeyResolver = async (apiKey: string) => {
  try {
    const user = AuthToken.verifyAPIKey(apiKey);
    return {
      id: String(user.id ?? ''),
      name: String((user as any).userName ?? 'service'),
      apiKey,
    };
  } catch {
    return null;
  }
};

// The EntityStatusService handler projects status via the workflow-entity
// registry (syncStatus). This process loads neither the HTTP app nor the wallet
// use-cases, so register the entities explicitly or the registry stays empty and
// every sync is a silent no-op.
registerWalletWorkflowEntities();

startGrpcServer();
