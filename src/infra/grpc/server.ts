import * as path from 'path';
import {
  Server,
  ServerCredentials,
  loadPackageDefinition,
} from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/index';
import { withModuleAuth } from './authInterceptor';
import { syncEntityStatus } from '../../modules/Wallet/infra/grpc/entityStatus.handlers';
import {
  listEntitySources,
  listEntityValues,
  entityValuesExist,
} from '../../modules/Wallet/infra/grpc/entityQuery.handlers';

// proto-loader options shared by every service definition we host.
const LOADER_OPTS = {
  keepCase: true, // request/response fields stay snake_case (matches handlers)
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
} as const;

// Resolve protos from the project root (cwd under `npm run grpc`), mirroring how
// the workflow client resolves its proto.
function loadService(file: string, qualifiedName: string): any {
  const proto: any = loadPackageDefinition(
    protoLoader.loadSync(path.resolve(process.cwd(), file), LOADER_OPTS),
  );
  return qualifiedName.split('.').reduce((node, part) => node[part], proto);
}

// Engine -> wallet status projection. Wallet owns the `wallet` entity; the
// engine pushes each committed transition here (FR-WF-1/2).
const EntityStatusService = loadService(
  'proto/entityStatus.proto',
  'accounts.v1.EntityStatusService',
);
// Generic entity value-source API: exposes this service's own entities (e.g.
// WalletType) so other services can tag their select variables against them.
const EntityQueryService = loadService(
  'proto/entityQuery.proto',
  'entityquery.v1.EntityQueryService',
);

export function buildGrpcServer(): Server {
  const server = new Server();
  // Every method is wrapped with the API-key auth gate (service-to-service).
  server.addService(EntityStatusService.service, {
    SyncEntityStatus: withModuleAuth(syncEntityStatus as any),
  });
  server.addService(EntityQueryService.service, {
    ListEntitySources: withModuleAuth(listEntitySources as any),
    ListEntityValues: withModuleAuth(listEntityValues as any),
    EntityValuesExist: withModuleAuth(entityValuesExist as any),
  });
  return server;
}

export function startGrpcServer(): void {
  const server = buildGrpcServer();
  const address = `${config.grpc.bindAddress}:${config.grpc.port}`;
  server.bindAsync(address, ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('[grpc] failed to bind:', err);
      process.exit(1);
    }
    console.log(
      `[grpc] EntityStatusService + EntityQueryService listening on ${config.grpc.bindAddress}:${port}`,
    );
  });
}
