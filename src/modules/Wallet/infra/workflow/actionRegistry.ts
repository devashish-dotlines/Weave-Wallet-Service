/**
 * Registry of workflow ENGINE ACTIONS this service can perform, keyed by the
 * engine `ActionDefinition.slug`. When the engine dispatches a gRPC action
 * (EntityStatusService.DispatchAction), the gRPC adapter resolves the slug here
 * and runs the handler.
 *
 * Adding a new action = one `register()` call in registerActions.ts — the gRPC
 * adapter stays generic and never changes. Mirrors the Accounts registry.
 */

export interface ActionInput {
  /** The entity the action targets (engine `entity_id`). */
  entityId: string;
  /** Parsed action payload from the engine's payloadTemplate ({} when none). */
  payload: Record<string, unknown>;
}

/**
 * A handler resolves for success, throws for a RETRYABLE failure, or returns
 * `{ ok: false }` for a PERMANENT one (the engine stops retrying and does not
 * advance the instance).
 */
export type ActionOutcome = void | { ok: false; message: string };
export type ActionHandler = (input: ActionInput) => Promise<ActionOutcome>;

/** Human-facing metadata for an action, surfaced to the panel via ListActions. */
export interface ActionMeta {
  label?: string;
  description?: string;
}

export interface RegisteredAction {
  slug: string;
  label: string;
  description: string;
}

interface Entry {
  handler: ActionHandler;
  label: string;
  description: string;
}

export class WalletActionRegistry {
  private readonly bySlug = new Map<string, Entry>();

  register(slug: string, handler: ActionHandler, meta: ActionMeta = {}): void {
    if (!slug) {
      throw new Error('WalletActionRegistry.register: slug is required');
    }
    this.bySlug.set(slug, {
      handler,
      label: meta.label ?? slug,
      description: meta.description ?? '',
    });
  }

  get(slug: string): ActionHandler | undefined {
    return this.bySlug.get(slug)?.handler;
  }

  has(slug: string): boolean {
    return this.bySlug.has(slug);
  }

  list(): RegisteredAction[] {
    return Array.from(this.bySlug.entries()).map(([slug, entry]) => ({
      slug,
      label: entry.label,
      description: entry.description,
    }));
  }
}

export const walletActions = new WalletActionRegistry();
