/**
 * Generic, entity-agnostic contract onto the external workflow-engine.
 *
 * Integrating any entity needs three things (engine concepts):
 *   1. module      — this service's identity in the engine (api_key + module id, from env)
 *   2. workflowType — one per entity, registered in the entity registry
 *   3. entity      — a live instance, addressed by (entityType, entityId)
 *
 * The high-level `IWorkflowIntegration` is keyed by `entityType`; it resolves the
 * workflowType from the registry and delegates to the low-level engine client.
 * Nothing here knows about Organization or any specific entity.
 */

// ---- result shapes (mirror the engine's responses, camelCased) -------------

export interface InitiateResult {
  instanceId: string;
  /** The initial status the instance was placed at. */
  statusId: string;
  /** Whether that initial status is marked active in the engine. */
  statusActive: boolean;
  /** Display name of the initial status. */
  statusName: string;
  /** Display color of the initial status (null when unset). */
  statusColor: string | null;
}

export interface TransitionResult {
  instanceId: string;
  fromStatusId: string;
  toStatusId: string;
  closed: boolean;
  logId: string;
  /** Whether the status the instance moved INTO is marked active in the engine. */
  toStatusActive: boolean;
  /** Display name of the status the instance moved INTO. */
  toStatusName: string;
  /** Display color of the status the instance moved INTO (null when unset). */
  toStatusColor: string | null;
}

export interface AllowedTransition {
  toStatusId: string;
  toStatusName: string;
  toStatusSlug: string;
  ruleId: string;
}

export interface AllowedTransitionsResult {
  instanceId: string;
  currentStatusId: string;
  isClosed: boolean;
  transitions: AllowedTransition[];
  /** Whether the instance's CURRENT status is marked active in the engine. */
  currentStatusActive: boolean;
  /** Display name of the instance's CURRENT status. */
  currentStatusName: string;
  /** Display color of the instance's CURRENT status (null when unset). */
  currentStatusColor: string | null;
}

// ---- high-level API (entity-keyed) — what app code calls -------------------

export interface InitiateInput {
  entityId: string;
  requestedBy: string;
  roleIds: string[];
  metadata?: Record<string, unknown>;
}

export interface TransitionInput {
  entityId: string;
  fromStatusId: string;
  toStatusId: string;
  requestedBy: string;
  roleIds: string[];
  note?: string;
}

export interface AllowedTransitionsInput {
  entityId: string;
  requestedBy: string;
  roleIds: string[];
}

export interface IWorkflowIntegration {
  /** Initiate an instance for an entity at its initial status. */
  initiate(entityType: string, input: InitiateInput): Promise<InitiateResult>;
  /** Drive an entity instance from one status to another. */
  executeTransition(
    entityType: string,
    input: TransitionInput,
  ): Promise<TransitionResult>;
  /** Read current status + the transitions available to the caller's roles. */
  allowedTransitions(
    entityType: string,
    input: AllowedTransitionsInput,
  ): Promise<AllowedTransitionsResult>;
}

// ---- low-level engine client (full requests; carries workflowTypeId) -------

export interface EngineInitiateRequest extends InitiateInput {
  workflowTypeId: string;
  entityType: string;
}
export interface EngineTransitionRequest extends TransitionInput {
  workflowTypeId: string;
  entityType: string;
}
export interface EngineAllowedRequest extends AllowedTransitionsInput {
  workflowTypeId: string;
  entityType: string;
}

export interface IWorkflowEngineClient {
  initiate(req: EngineInitiateRequest): Promise<InitiateResult>;
  executeTransition(req: EngineTransitionRequest): Promise<TransitionResult>;
  allowedTransitions(
    req: EngineAllowedRequest,
  ): Promise<AllowedTransitionsResult>;
}

/**
 * Raised when the engine rejects a call or is unreachable. `grpcCode` is the
 * @grpc/grpc-js status code; callers translate it to their own error taxonomy.
 * `retriable` marks transport failures (UNAVAILABLE/DEADLINE_EXCEEDED).
 */
export class WorkflowEngineError extends Error {
  constructor(
    public readonly grpcCode: number,
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = 'WorkflowEngineError';
  }
}
