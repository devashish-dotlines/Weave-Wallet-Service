import { CollectionAccountInfo } from '../../../infra/grpc/clients/ledgerClient';

/** Anything that can list accounting collection accounts (the ledger client, or a fake). */
export interface CollectionAccountSource {
  listCollectionAccounts(): Promise<CollectionAccountInfo[]>;
}

/** Accounting can't be reached and nothing is cached to fall back on. */
export class CollectionAccountsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionAccountsUnavailableError';
  }
}

export interface ICollectionAccountDirectory {
  /** Active accounts grouped by the currency they are paid in (upper-case code). */
  byCurrency(): Promise<Record<string, CollectionAccountInfo[]>>;
}

const CACHE_TTL_MS = 60_000;

/**
 * The org's bank / MFS accounts customers pay into, owned by accounting
 * (Accounting → Collection Accounts) and read over LedgerService, cached for a
 * minute. Accounting only returns ACTIVE accounts. A stale list beats no list:
 * while accounting blips, the last one serves.
 */
export class CollectionAccountDirectory implements ICollectionAccountDirectory {
  private cache: { at: number; value: CollectionAccountInfo[] } | null = null;

  constructor(private readonly source: CollectionAccountSource | null) {}

  private async list(): Promise<CollectionAccountInfo[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    if (!this.source) {
      throw new CollectionAccountsUnavailableError(
        'Accounting service is not configured (ACCOUNTING_GRPC_TARGET)',
      );
    }
    let value: CollectionAccountInfo[];
    try {
      value = await this.source.listCollectionAccounts();
    } catch (err) {
      if (this.cache) return this.cache.value;
      throw new CollectionAccountsUnavailableError(
        `Collection accounts unavailable: ${(err as Error).message}`,
      );
    }
    this.cache = { at: Date.now(), value };
    return value;
  }

  async byCurrency(): Promise<Record<string, CollectionAccountInfo[]>> {
    const out: Record<string, CollectionAccountInfo[]> = {};
    for (const a of await this.list()) {
      (out[a.currencyCode] ??= []).push(a);
    }
    return out;
  }
}
