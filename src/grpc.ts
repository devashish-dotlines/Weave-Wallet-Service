require('dotenv').config();

// Load Sequelize models and (transitively, via the Wallet repos) the state the
// gRPC handlers depend on. Express is NOT started here — the gRPC server runs as
// its own process (`npm run grpc`).
import './infra/sequelize';
import './modules/Wallet/repos';
import { registerWalletWorkflowEntities } from './modules/Wallet/infra/workflow/registerEntities';
import { registerWalletActions } from './modules/Wallet/infra/workflow/registerActions';
import { startGrpcServer } from './infra/grpc/server';

// NOTE: service-to-service auth for inbound gRPC is installed by the
// `./modules/Wallet/repos` import above — the DB-backed resolver that verifies
// the presented key against the `registered_service` table, i.e. the keys the
// /v1/wallet/services registration API issues. This module used to overwrite
// that slot with a JWT verifier (`AuthToken.verifyAPIKey`), which silently broke
// every registry-issued key over gRPC (imports evaluate before the module body,
// so the override always won) while REST kept working, since the HTTP entrypoint
// never overrode it. Do not reintroduce that override.

// The EntityStatusService handler projects status via the workflow-entity
// registry (syncStatus). This process loads neither the HTTP app nor the wallet
// use-cases, so register the entities explicitly or the registry stays empty and
// every sync is a silent no-op.
registerWalletWorkflowEntities();

// DispatchAction resolves engine action slugs against the action registry, which
// is only populated by this call — without it every dispatch is "unknown action".
registerWalletActions();

startGrpcServer();
