import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {
  IWorkflowEngineClient,
  EngineInitiateRequest,
  EngineTransitionRequest,
  EngineAllowedRequest,
  InitiateResult,
  TransitionResult,
  AllowedTransitionsResult,
  WorkflowEngineError,
} from './types';

// Resolve the proto from the project root (cwd under `npm start`/nodemon),
// mirroring how the engine resolves it.
const PROTO_PATH = path.resolve(process.cwd(), 'proto/workflow.proto');

// keepCase:true so request/response fields stay snake_case (engine parity).
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto: any = grpc.loadPackageDefinition(packageDefinition);
const WorkflowServiceClient = proto.workflow.v1.WorkflowService;

const RETRIABLE = new Set<number>([
  grpc.status.UNAVAILABLE,
  grpc.status.DEADLINE_EXCEEDED,
]);

/**
 * Low-level gRPC client onto the engine's WorkflowService. Authenticates every
 * call with this service's Module api_key (`x-api-key`) and tags it with the
 * module id (`x-module-id`) for traceability. A single insecure channel is
 * reused — both peers live behind the trusted mesh, never APISix.
 */
export class WorkflowGrpcClient implements IWorkflowEngineClient {
  private readonly client: any;

  constructor(
    target: string,
    private readonly apiKey: string,
    private readonly moduleId: string,
    private readonly deadlineMs: number,
  ) {
    this.client = new WorkflowServiceClient(
      target,
      grpc.credentials.createInsecure(),
    );
  }

  private metadata(): grpc.Metadata {
    const md = new grpc.Metadata();
    md.set('x-api-key', this.apiKey);
    if (this.moduleId) md.set('x-module-id', this.moduleId);
    return md;
  }

  private deadline(): grpc.CallOptions {
    return { deadline: Date.now() + this.deadlineMs };
  }

  private invoke<TRes>(method: string, request: any): Promise<TRes> {
    return new Promise<TRes>((resolve, reject) => {
      this.client[method](
        request,
        this.metadata(),
        this.deadline(),
        (err: grpc.ServiceError | null, response: TRes) => {
          if (err) {
            const code = err.code ?? grpc.status.UNKNOWN;
            return reject(
              new WorkflowEngineError(
                code,
                `workflow-engine ${method} failed: ${err.details || err.message}`,
                RETRIABLE.has(code),
              ),
            );
          }
          resolve(response);
        },
      );
    });
  }

  async initiate(req: EngineInitiateRequest): Promise<InitiateResult> {
    const res = await this.invoke<any>('initiate', {
      workflow_type_id: req.workflowTypeId,
      entity_type: req.entityType,
      entity_id: req.entityId,
      role_ids: req.roleIds,
      requested_by: req.requestedBy,
      metadata_json: req.metadata ? JSON.stringify(req.metadata) : '',
    });
    return {
      instanceId: String(res.instance_id),
      statusId: String(res.initial_status_id),
      statusActive: Boolean(res.initial_status_active),
      statusName: String(res.initial_status_name ?? ''),
      statusColor: res.initial_status_color ? String(res.initial_status_color) : null,
    };
  }

  async executeTransition(
    req: EngineTransitionRequest,
  ): Promise<TransitionResult> {
    const res = await this.invoke<any>('executeTransition', {
      workflow_type_id: req.workflowTypeId,
      entity_type: req.entityType,
      entity_id: req.entityId,
      from_status_id: req.fromStatusId,
      to_status_id: req.toStatusId,
      note: req.note ?? '',
      role_ids: req.roleIds,
      requested_by: req.requestedBy,
    });
    return {
      instanceId: String(res.instance_id),
      fromStatusId: String(res.from_status_id),
      toStatusId: String(res.to_status_id),
      closed: Boolean(res.closed),
      logId: String(res.log_id),
      toStatusActive: Boolean(res.to_status_active),
      toStatusName: String(res.to_status_name ?? ''),
      toStatusColor: res.to_status_color ? String(res.to_status_color) : null,
    };
  }

  async allowedTransitions(
    req: EngineAllowedRequest,
  ): Promise<AllowedTransitionsResult> {
    const res = await this.invoke<any>('allowedTransitions', {
      workflow_type_id: req.workflowTypeId,
      entity_type: req.entityType,
      entity_id: req.entityId,
      role_ids: req.roleIds,
      requested_by: req.requestedBy,
    });
    const transitions = Array.isArray(res.transitions) ? res.transitions : [];
    return {
      instanceId: String(res.instance_id),
      currentStatusId: String(res.current_status_id),
      isClosed: Boolean(res.is_closed),
      currentStatusActive: Boolean(res.current_status_active),
      currentStatusName: String(res.current_status_name ?? ''),
      currentStatusColor: res.current_status_color
        ? String(res.current_status_color)
        : null,
      transitions: transitions.map((t: any) => ({
        toStatusId: String(t.to_status_id),
        toStatusName: String(t.to_status_name),
        toStatusSlug: String(t.to_status_slug),
        ruleId: String(t.rule_id),
      })),
    };
  }
}
