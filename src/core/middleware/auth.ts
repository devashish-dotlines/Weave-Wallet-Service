import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import { IUser } from '../interface/iuser';

/**
 * Resolves a Module by its raw API key for inter-service auth (gRPC + service
 * REST). Declared here as an injectable seam — the concrete implementation
 * (backed by the Workflow module's Module repo) is wired at a composition root,
 * mirroring the dependency-inversion shape used elsewhere in the starter. Until
 * wired it denies by default, so a missing wiring fails closed.
 */
export interface IModulePrincipal {
  id: string;
  name: string;
  apiKey: string;
}

export type ModuleApiKeyResolver = (
  apiKey: string,
) => Promise<IModulePrincipal | null>;

export class Auth {
  /**
   * Injection seam for API-key -> Module resolution. Defaults to deny-by-default;
   * the Workflow module overrides this at boot (see Workflow/repos/index.ts).
   */
  static moduleApiKeyResolver: ModuleApiKeyResolver = async () => null;

  /**
   * Resolves the permission codes granted to a set of (opaque) role refs from
   * the gateway token. Injected at a composition root (Authorization/repos)
   * from the engine's own role_permission grants, keeping `core/` free of any
   * `modules/` import. Until injected, `req.user.permissions` is left undefined
   * and `requirePermission` denies non-superusers by default (fail-closed).
   */
  static permissionResolver:
    | ((roleRefs: string[]) => Promise<string[]>)
    | null = null;

  /**
   * Resolves opaque role ids (UUIDs) → their Keycloak realm-role names. Injected
   * from the same Accounts gRPC client as permissionResolver. Used by the
   * transition path to translate a rule's stored role UUID into the name form a
   * principal's token carries, so the two can be matched. Until injected it's
   * left null and the transition matcher falls back to ANY-wildcard rules only.
   */
  static roleNameResolver:
    | ((roleIds: string[]) => Promise<Map<string, string>>)
    | null = null;

  /**
   * Builds the request principal from the APISix-verified gateway token. APISix's
   * openid-connect plugin has ALREADY verified the Keycloak (RS256) signature
   * upstream, so the engine only DECODES the forwarded JWT to read identity +
   * roles — it does NOT re-verify (a shared HMAC secret would reject the RS256
   * token with "invalid algorithm"). Mirrors the Accounts API precedent the same
   * gateway already fronts. NO Redis/DB lookup and NO outbound identity call.
   *
   * Reads Keycloak claim shapes (`sub`, `realm_access.roles`, `preferred_username`)
   * with the engine's flatter `id`/`roles` claims as fallback. `id` is the
   * Keycloak subject UUID, carried through as the opaque `requestedBy`.
   */
  private static principalFromClaims(decoded: Record<string, any>): IUser {
    const rawRoles = Array.isArray(decoded?.realm_access?.roles)
      ? decoded.realm_access.roles
      : (decoded.roles ?? decoded.role);
    const roles = Array.isArray(rawRoles)
      ? (rawRoles as any[]).map((r) => String(r))
      : typeof rawRoles === 'string' && rawRoles.length > 0
      ? [rawRoles]
      : undefined;

    return {
      id: String(decoded.id ?? decoded.sub ?? ''),
      userName: String(
        decoded.userName ?? decoded.preferred_username ?? decoded.email ?? '',
      ),
      email: decoded.email ? String(decoded.email) : undefined,
      firstName: String(decoded.firstName ?? decoded.given_name ?? ''),
      lastName: decoded.lastName
        ? String(decoded.lastName)
        : decoded.family_name
        ? String(decoded.family_name)
        : undefined,
      isSuperuser: decoded.isSuperuser === true,
      roles,
    };
  }

  static async authenticateGateway(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const UNAUTHORIZED = 'Unauthorized';
    try {
      let token = req.headers['authorization'];
      if (!token || !token.startsWith('Bearer ')) {
        return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
      }
      token = token.replace('Bearer ', '').trim();
      // No verify, no secret — APISix already verified the signature upstream.
      const decoded = jwt.decode(token) as Record<string, any> | null;
      if (!decoded || typeof decoded !== 'object') {
        return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
      }
      const user = Auth.principalFromClaims(decoded);
      if (!user.id) {
        return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
      }

      // Resolve permission codes from the principal's role refs (RBAC over the
      // engine's config endpoints). Superusers bypass permission checks, so the
      // lookup is skipped for them.
      if (!user.isSuperuser && Auth.permissionResolver) {
        try {
          user.permissions = await Auth.permissionResolver(user.roles ?? []);
        } catch (err) {
          console.error('permissionResolver error:', err);
          user.permissions = [];
        }
      }

      req.user = user;
      return next();
    } catch (err) {
      console.error('authenticateGateway error:', err);
      return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
    }
  }

  /**
   * Back-compat alias. All REST traffic is gateway-authenticated.
   */
  static async authenticate(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    return Auth.authenticateGateway(req, res, next);
  }

  /**
   * Service-to-service auth over REST via a Module API key
   * (`Authorization: Bearer <apiKey>` or `x-api-key`). Resolves an active,
   * non-voided Module through the injected resolver and exposes it on
   * `req.user`. The same resolver backs the gRPC interceptor.
   */
  static async authenticateAPIKey(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const UNAUTHORIZED = 'Unauthorized';
    try {
      const header = req.headers['authorization'];
      const apiKey = header?.startsWith('Bearer ')
        ? header.replace('Bearer ', '').trim()
        : (req.headers['x-api-key'] as string | undefined);

      if (!apiKey) {
        return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
      }

      const module = await Auth.moduleApiKeyResolver(apiKey);
      if (!module) {
        return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
      }

      req.user = {
        id: module.id,
        userName: module.name,
        firstName: module.name,
        isSuperuser: false,
      };
      return next();
    } catch (err) {
      console.error('authenticateAPIKey error:', err);
      return next(Object.assign(new Error(UNAUTHORIZED), { status: 401 }));
    }
  }
}
