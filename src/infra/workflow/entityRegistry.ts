import { IUser } from '../../core/interface/iuser';

/** Per-entity authorization: may this actor act on this instance? */
export type WorkflowAuthorize = (
  entityId: string,
  actor?: IUser,
) => Promise<boolean>;

/** Per-entity existence check (so the engine isn't hit for unknown ids). */
export type WorkflowExists = (entityId: string) => Promise<boolean>;

/** Current workflow status of an instance, as reported by the engine. */
export interface WorkflowStatusSnapshot {
  statusId: string;
  /** True once the instance reaches a terminal status. */
  closed?: boolean;
  /** Whether the engine marks this status as active (drives the local `active` flag). */
  active?: boolean;
  /** Engine display name of this status. */
  name?: string;
  /** Engine display color of this status (null when unset). */
  color?: string | null;
}

/**
 * Persist an instance's current workflow status back onto the owning entity's
 * table. The engine is authoritative; this keeps a local projection so reads /
 * lists can show status without a per-row engine call. Best-effort — a failure
 * here never fails the originating request (the engine already committed).
 */
export type WorkflowSyncStatus = (
  entityId: string,
  status: WorkflowStatusSnapshot,
) => Promise<void>;

export interface WorkflowEntityConfig {
  /** The engine WorkflowType id for this entity (env-supplied). */
  workflowTypeId: string;
  /** Scope/permission check. Omitted ⇒ no entity-specific authorization. */
  authorize?: WorkflowAuthorize;
  /** Existence check. Omitted ⇒ existence not verified before engine calls. */
  exists?: WorkflowExists;
  /**
   * Project the engine's current status onto the local entity row. Omitted ⇒
   * status is read live from the engine only (no local copy kept).
   */
  syncStatus?: WorkflowSyncStatus;
  /**
   * Per-operation permission code the caller must hold (superusers bypass). The
   * owning module supplies codes from its own catalog — keeps this generic.
   */
  requiredPermissions?: { status?: string; transition?: string };
}

/**
 * Maps each integrated `entityType` → its engine workflowType + policy.
 *
 * Owning modules register their entities at a composition root (e.g. Accounts
 * registers `organization` with its scope check). The central workflow router
 * and the generic integration both read from here, so no entity-specific code
 * or config leaks into either.
 */
export class WorkflowEntityRegistry {
  private readonly byEntityType = new Map<string, WorkflowEntityConfig>();

  /** Register (or override) an entity's workflowType + policy. */
  register(entityType: string, config: WorkflowEntityConfig): void {
    if (!entityType) {
      throw new Error('WorkflowEntityRegistry.register: entityType is required');
    }
    this.byEntityType.set(entityType, config);
  }

  /** Resolve an entity's config, or throw if unregistered. */
  resolve(entityType: string): WorkflowEntityConfig {
    const config = this.byEntityType.get(entityType);
    if (!config) {
      throw new Error(
        `No workflowType registered for entity '${entityType}'. ` +
          `Register it (and set its *_TYPE_ID env) before using the workflow integration.`,
      );
    }
    return config;
  }

  has(entityType: string): boolean {
    return this.byEntityType.has(entityType);
  }
}
