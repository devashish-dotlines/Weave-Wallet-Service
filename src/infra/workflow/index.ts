import { config } from '../../config';
import { WorkflowEntityRegistry } from './entityRegistry';
import { WorkflowGrpcClient } from './grpcClient';
import {
  WorkflowIntegration,
  UnconfiguredEngineClient,
} from './workflowIntegration';
import { IWorkflowEngineClient, IWorkflowIntegration } from './types';

export * from './types';

/**
 * Service-level workflow module identity (the engine's `Module`). All three
 * coordinates come from env: the gRPC target, this service's api_key, and its
 * module id. Per-entity workflowType ids are registered separately on
 * `workflowEntities` (see each module's composition root).
 */
const configured =
  !!config.workflow.grpcTarget &&
  !!config.workflow.apiKey &&
  !!config.workflow.moduleId;

const engineClient: IWorkflowEngineClient = configured
  ? new WorkflowGrpcClient(
      config.workflow.grpcTarget,
      config.workflow.apiKey,
      config.workflow.moduleId,
      config.workflow.deadlineMs,
    )
  : new UnconfiguredEngineClient();

/** The entity → workflowType registry. Modules register their entities here. */
export const workflowEntities = new WorkflowEntityRegistry();

/** The generic, entity-keyed integration the rest of the app depends on. */
export const workflowIntegration: IWorkflowIntegration = new WorkflowIntegration(
  engineClient,
  workflowEntities,
);

if (!configured) {
  console.warn(
    '[workflow] WORKFLOW_GRPC_TARGET/WORKFLOW_API_KEY/WORKFLOW_MODULE_ID not all set — ' +
      'workflow operations will fail until configured.',
  );
}
