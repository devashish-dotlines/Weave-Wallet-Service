import {
  sendUnaryData,
  ServerUnaryCall,
  status as GrpcStatus,
} from '@grpc/grpc-js';
import { Auth, IModulePrincipal } from '../../core/middleware/auth';

/**
 * Per-call API-key gate for gRPC. Reads `x-api-key` (or a bearer
 * `authorization`) from call metadata and resolves the calling service via the
 * injected `Auth.moduleApiKeyResolver` — the same seam REST service-auth uses.
 * On success the resolved caller is attached to the call for handlers to read;
 * otherwise the call is rejected with UNAUTHENTICATED before the handler runs.
 *
 * This is the service-to-service path: callers present their own service API
 * key, NEVER the gateway (Keycloak) JWT.
 */
export interface AuthedCall<Req> extends ServerUnaryCall<Req, any> {
  module?: IModulePrincipal;
}

export type UnaryHandler<Req, Res> = (
  call: AuthedCall<Req>,
  callback: sendUnaryData<Res>,
) => void;

function extractApiKey<Req>(call: ServerUnaryCall<Req, any>): string | null {
  const fromKey = call.metadata.get('x-api-key');
  if (fromKey && fromKey.length > 0) return String(fromKey[0]);
  const authz = call.metadata.get('authorization');
  if (authz && authz.length > 0) {
    return String(authz[0]).replace('Bearer ', '').trim();
  }
  return null;
}

export function withModuleAuth<Req, Res>(
  handler: UnaryHandler<Req, Res>,
): UnaryHandler<Req, Res> {
  return (call, callback) => {
    const apiKey = extractApiKey(call);
    if (!apiKey) {
      return callback({
        code: GrpcStatus.UNAUTHENTICATED,
        message: 'Missing API key',
      });
    }
    Auth.moduleApiKeyResolver(apiKey)
      .then((module) => {
        if (!module) {
          return callback({
            code: GrpcStatus.UNAUTHENTICATED,
            message: 'Invalid or inactive API key',
          });
        }
        call.module = module;
        return handler(call, callback);
      })
      .catch((err) => {
        console.error('[grpc-auth] resolver error:', err);
        return callback({
          code: GrpcStatus.UNAUTHENTICATED,
          message: 'Authentication failed',
        });
      });
  };
}
