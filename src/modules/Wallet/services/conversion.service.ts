import { IUomRateRepo } from '../repos/interface/IUomRateRepo';
import {
  CurrencyCatalog,
  CurrencyCatalogUnavailableError,
} from './currencyCatalog.service';
import { ResolvedUnit } from './unitRegistry.service';

/**
 * Converts a deposit in any currency into a wallet's own unit, and into the
 * accounting base currency for the GL.
 *
 * Two anchored sources rather than a pair-per-combination grid:
 *   • accounting `acc_currency` — BASE amount one unit of a currency is worth
 *                                 (base MYR: 1 USD = 4.0975 → conversionRate 4.0975)
 *   • wallet `wlt_uom_rate`     — BASE amount one LOCAL valued unit is worth
 *
 *     baseAmount = depositAmount × conversionRate(currency)
 *     credit     = baseAmount / baseValue(unit)
 *
 * The unit's category decides where its base value comes from: a CURRENCY
 * unit is its own acc_currency rate; a LOCAL valued unit (POINTS) uses its
 * effective rate row; an unvalued unit (TIME, DATA) can't be priced at all.
 */
export class ConversionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionUnavailableError';
  }
}

export interface UomRateQuote {
  /** Units of `currency` worth one wallet unit (1 POINT = 30 BDT → 30). */
  rate: number;
  /** Base-currency amount one wallet unit is worth. */
  baseValue: number;
  baseCurrency: string;
}

export interface IConversionService {
  /** Currencies a wallet unit can be funded in, with the rate for each. */
  ratesFor(unit: ResolvedUnit, atSeconds: number): Promise<Record<string, number>>;
  /** The rate for one currency; throws when it cannot be derived. */
  rateFor(
    unit: ResolvedUnit,
    currencyCode: string,
    atSeconds: number,
  ): Promise<UomRateQuote>;
  /** Amount in base currency for a sum of money in `currencyCode`. */
  toBase(amount: number, currencyCode: string): Promise<{ amount: number; baseCurrency: string }>;
}

export class ConversionService implements IConversionService {
  constructor(
    private readonly catalog: CurrencyCatalog,
    private readonly rateRepo: IUomRateRepo,
  ) {}

  private async currencies() {
    try {
      return await this.catalog.list();
    } catch (err) {
      if (err instanceof CurrencyCatalogUnavailableError) {
        throw new ConversionUnavailableError(err.message);
      }
      throw err;
    }
  }

  /** Base-currency value of one unit, by where the unit's category says it lives. */
  private async baseValueOf(unit: ResolvedUnit, atSeconds: number): Promise<number> {
    if (!unit.valued) {
      throw new ConversionUnavailableError(
        `${unit.code} is a quantity-only unit (${unit.categoryCode}); it has no money value`,
      );
    }
    if (unit.unitSource === 'ACCOUNTING_CURRENCY') {
      const list = await this.currencies();
      const c = list.currencies.find((x) => x.id === unit.unitId);
      if (!c || !(c.conversionRate > 0)) {
        throw new ConversionUnavailableError(
          `Currency ${unit.code} has no usable conversion rate`,
        );
      }
      return c.conversionRate;
    }
    const rate = await this.rateRepo.findEffective(unit.unitId, atSeconds);
    if (!rate) {
      throw new ConversionUnavailableError(
        `No rate configured for ${unit.code}; set one under Unit Conversion Rates`,
      );
    }
    return rate.baseValue;
  }

  async ratesFor(
    unit: ResolvedUnit,
    atSeconds: number,
  ): Promise<Record<string, number>> {
    const list = await this.currencies();
    const baseValue = await this.baseValueOf(unit, atSeconds);
    const out: Record<string, number> = {};
    for (const c of list.currencies) {
      // Units of the currency worth one wallet unit.
      if (c.conversionRate > 0) out[c.code] = baseValue / c.conversionRate;
    }
    return out;
  }

  async rateFor(
    unit: ResolvedUnit,
    currencyCode: string,
    atSeconds: number,
  ): Promise<UomRateQuote> {
    const currency = currencyCode.toUpperCase();
    const list = await this.currencies();
    const found = list.currencies.find((c) => c.code === currency);
    if (!found || !(found.conversionRate > 0)) {
      throw new ConversionUnavailableError(`Unknown currency ${currency}`);
    }
    const baseValue = await this.baseValueOf(unit, atSeconds);
    return {
      rate: baseValue / found.conversionRate,
      baseValue,
      baseCurrency: list.baseCode,
    };
  }

  async toBase(
    amount: number,
    currencyCode: string,
  ): Promise<{ amount: number; baseCurrency: string }> {
    const currency = currencyCode.toUpperCase();
    const list = await this.currencies();
    const found = list.currencies.find((c) => c.code === currency);
    if (!found || !(found.conversionRate > 0)) {
      throw new ConversionUnavailableError(`Unknown currency ${currency}`);
    }
    return {
      amount: Math.round(amount * found.conversionRate * 100) / 100,
      baseCurrency: list.baseCode,
    };
  }
}
