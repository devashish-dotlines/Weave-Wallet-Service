import {
  CurrencyInfo,
  CurrencyList,
} from '../../../infra/grpc/clients/ledgerClient';

/** Anything that can list accounting currencies (the ledger client, or a fake). */
export interface CurrencySource {
  listCurrencies(): Promise<CurrencyList>;
}

/** Accounting can't be reached and nothing is cached to fall back on. */
export class CurrencyCatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurrencyCatalogUnavailableError';
  }
}

const CACHE_TTL_MS = 60_000;

/**
 * Accounting's currency list (acc_currency via LedgerService.ListCurrencies),
 * cached for a minute. CURRENCY-category units ARE these rows — the wallet
 * keeps no copy — so both the UnitRegistry and the ConversionService read them
 * here. A stale list beats no list: while accounting blips, the last one serves.
 */
export class CurrencyCatalog {
  private cache: { at: number; value: CurrencyList } | null = null;

  constructor(private readonly source: CurrencySource | null) {}

  async list(): Promise<CurrencyList> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    if (!this.source) {
      throw new CurrencyCatalogUnavailableError(
        'Accounting service is not configured (ACCOUNTING_GRPC_TARGET)',
      );
    }
    let value: CurrencyList;
    try {
      value = await this.source.listCurrencies();
    } catch (err) {
      if (this.cache) return this.cache.value;
      throw new CurrencyCatalogUnavailableError(
        `Currency list unavailable: ${(err as Error).message}`,
      );
    }
    if (!value.baseCode) {
      throw new CurrencyCatalogUnavailableError('Accounting has no base currency');
    }
    this.cache = { at: Date.now(), value };
    return value;
  }

  async byId(id: string): Promise<CurrencyInfo | undefined> {
    return (await this.list()).currencies.find((c) => c.id === id);
  }

  async byCode(code: string): Promise<CurrencyInfo | undefined> {
    const upper = code.toUpperCase();
    return (await this.list()).currencies.find((c) => c.code === upper);
  }
}
