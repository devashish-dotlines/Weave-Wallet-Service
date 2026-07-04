import * as grpc from '@grpc/grpc-js';
import { WorkflowEntityRegistry } from './entityRegistry';
import {
  IWorkflowIntegration,
  IWorkflowEngineClient,
  InitiateInput,
  TransitionInput,
  AllowedTransitionsInput,
  InitiateResult,
  TransitionResult,
  AllowedTransitionsResult,
  EngineInitiateRequest,
  EngineTransitionRequest,
  EngineAllowedRequest,
  WorkflowEngineError,
} from './types';

/**
 * Generic workflow integration. Resolves the workflowType for an `entityType`
 * from the registry, then delegates to the engine client. Entity-agnostic:
 * adding a new integrated entity is one `registry.register(...)` call plus its
 * env-supplied workflowType id — no change here.
 */
export class WorkflowIntegration implements IWorkflowIntegration {
  constructor(
    private readonly client: IWorkflowEngineClient,
    private readonly registry: WorkflowEntityRegistry,
  ) {}

  async initiate(
    entityType: string,
    input: InitiateInput,
  ): Promise<InitiateResult> {
    const req: EngineInitiateRequest = {
      ...input,
      entityType,
      workflowTypeId: this.registry.resolve(entityType).workflowTypeId,
    };
    return this.client.initiate(req);
  }

  async executeTransition(
    entityType: string,
    input: TransitionInput,
  ): Promise<TransitionResult> {
    const req: EngineTransitionRequest = {
      ...input,
      entityType,
      workflowTypeId: this.registry.resolve(entityType).workflowTypeId,
    };
    return this.client.executeTransition(req);
  }

  async allowedTransitions(
    entityType: string,
    input: AllowedTransitionsInput,
  ): Promise<AllowedTransitionsResult> {
    const req: EngineAllowedRequest = {
      ...input,
      entityType,
      workflowTypeId: this.registry.resolve(entityType).workflowTypeId,
    };
    return this.client.allowedTransitions(req);
  }
}

/**
 * Engine client used when the workflow env is unset. The app still boots, but
 * any integrated operation fails loudly (engine is on the critical path).
 */
export class UnconfiguredEngineClient implements IWorkflowEngineClient {
  private fail(): never {
    throw new WorkflowEngineError(
      grpc.status.FAILED_PRECONDITION,
      'Workflow engine is not configured (set WORKFLOW_GRPC_TARGET, WORKFLOW_API_KEY, WORKFLOW_MODULE_ID)',
      false,
    );
  }
  async initiate(_req: EngineInitiateRequest): Promise<InitiateResult> {
    return this.fail();
  }
  async executeTransition(
    _req: EngineTransitionRequest,
  ): Promise<TransitionResult> {
    return this.fail();
  }
  async allowedTransitions(
    _req: EngineAllowedRequest,
  ): Promise<AllowedTransitionsResult> {
    return this.fail();
  }
}
