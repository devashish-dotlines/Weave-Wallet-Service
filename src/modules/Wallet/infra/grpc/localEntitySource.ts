import {
  walletTypeRepo,
  balanceTypeRepo,
  ownerTypeRepo,
  uomRepo,
} from '../../repos';

/** The `service` key under which this service's OWN entities are exposed. Peers
 *  tag their select variables as { service: SELF_SERVICE_KEY, entity, ... }; it
 *  must match the key rate-service registers this provider under. */
export const SELF_SERVICE_KEY = 'wallet';

/** A single key/label pair returned to the picker / evaluation. */
export interface EntityValueRow {
  key: string;
  value: string;
}

/** One entry in the picker: an entity this service offers as a value source. */
export interface EntitySourceRow {
  service: string;
  entity: string;
  displayName: string;
  keyField: string;
  valueField: string;
}

interface LocalEntityDef {
  entity: string;
  displayName: string;
  keyField: string;
  valueField: string;
  /** Resolve the entity's current key/value pairs from a local repo. */
  list: () => Promise<EntityValueRow[]>;
}

/**
 * Resolves this service's own entities straight from their local repos — no gRPC
 * to self. A repo error surfaces as `null` (fail-closed) exactly like a remote
 * outage would. Register only entities that are safe and meaningful to expose as
 * pick-lists to peer services.
 */
export class LocalEntityProvider {
  private readonly catalog: Map<string, LocalEntityDef>;

  constructor() {
    const defs: LocalEntityDef[] = [
      {
        entity: 'wallet_type',
        displayName: 'Wallet Type',
        keyField: 'id',
        valueField: 'name',
        list: async () =>
          (await walletTypeRepo.list()).map((w) => ({
            key: w.id.toString(),
            value: w.name,
          })),
      },
      {
        entity: 'balance_type',
        displayName: 'Balance Type',
        keyField: 'id',
        valueField: 'name',
        list: async () =>
          (await balanceTypeRepo.list()).map((b) => ({
            key: b.id.toString(),
            value: b.name,
          })),
      },
      {
        entity: 'owner_type',
        displayName: 'Owner Type',
        keyField: 'id',
        valueField: 'name',
        list: async () =>
          (await ownerTypeRepo.list()).map((o) => ({
            key: o.id.toString(),
            value: o.name,
          })),
      },
      {
        entity: 'uom',
        displayName: 'Unit of Measure',
        keyField: 'id',
        valueField: 'name',
        list: async () =>
          (await uomRepo.list()).map((u) => ({
            key: u.id.toString(),
            value: u.name,
          })),
      },
    ];
    this.catalog = new Map(defs.map((d) => [d.entity, d]));
  }

  async listEntitySources(): Promise<EntitySourceRow[]> {
    return [...this.catalog.values()].map((d) => ({
      service: SELF_SERVICE_KEY,
      entity: d.entity,
      displayName: d.displayName,
      keyField: d.keyField,
      valueField: d.valueField,
    }));
  }

  /** The entity's current key/value pairs, or null when unknown / a repo error. */
  async listEntityValues(entity: string): Promise<EntityValueRow[] | null> {
    const def = this.catalog.get(entity);
    if (!def) return null;
    try {
      return (await def.list()).filter((r) => r.key.length > 0);
    } catch (err) {
      console.error(
        `[entitysource:local] listing "${entity}" failed:`,
        (err as Error).message,
      );
      return null;
    }
  }

  async resolveAllowedKeys(entity: string): Promise<Set<string> | null> {
    const rows = await this.listEntityValues(entity);
    if (rows === null) return null;
    return new Set(rows.map((r) => r.key));
  }
}

export const localEntityProvider = new LocalEntityProvider();
