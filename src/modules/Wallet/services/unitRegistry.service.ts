import { UnitRef } from '../domain/unitRef';
import { UnitSource } from '../domain/uomCategory';
import { UnitInput } from '../DTO/walletDTO';
import { IUomCategoryRepo } from '../repos/interface/IUomCategoryRepo';
import { IUomRepo } from '../repos/interface/IUomRepo';
import { CurrencyCatalog } from './currencyCatalog.service';

/** A unit with everything a use case needs to know about it. */
export interface ResolvedUnit {
  categoryId: string;
  categoryCode: string;
  unitSource: UnitSource;
  /** Has a money value: can be priced, topped up, posted to the GL. */
  valued: boolean;
  /** Max decimals an amount in this unit may carry. */
  decimals: number;
  unitId: string;
  code: string;
  name: string;
  symbol?: string;
  /** How many of the category's base unit one of this is (1 for currencies). */
  factorToBase: number;
}

export class UnitResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitResolutionError';
  }
}

export interface IUnitRegistry {
  /** Null when the category or unit doesn't exist or is inactive. */
  resolve(ref: UnitRef): Promise<ResolvedUnit | null>;
  /** Every active unit of a category (for pickers and balance-type checks). */
  listUnits(categoryId: string): Promise<ResolvedUnit[]>;
  /**
   * Turn what a caller sent into a UnitRef. Accepts unitCategoryId + unitId,
   * or the LEGACY single `uomId` during the move to unit categories: a local
   * uom id maps to its own category; a retired currency uom id maps through
   * wlt_uom_legacy_map; an accounting currency id maps to the CURRENCY
   * category. Null when nothing usable was sent.
   */
  fromInput(input: UnitInput): Promise<UnitRef | null>;
  /** Null when `amount` is fine for the unit, else the reason it isn't. */
  checkAmount(amount: number, unit: ResolvedUnit): string | null;
  /**
   * Same-category conversion through the base unit, rounded DOWN to the target's
   * decimals so a conversion never creates value. Throws across categories.
   */
  convert(amount: number, from: ResolvedUnit, to: ResolvedUnit): number;
}

/**
 * The one place that knows where a unit lives. CURRENCY-category units are
 * accounting currencies (read through the CurrencyCatalog); LOCAL-category
 * units are wlt_uom rows. Use cases hold a UnitRef and ask here — they never
 * branch on the category themselves, so a new unit source is added in one place.
 */
export class UnitRegistry implements IUnitRegistry {
  constructor(
    private readonly categoryRepo: IUomCategoryRepo,
    private readonly uomRepo: IUomRepo,
    private readonly currencies: CurrencyCatalog,
  ) {}

  async resolve(ref: UnitRef): Promise<ResolvedUnit | null> {
    if (!ref?.categoryId || !ref?.unitId) return null;
    const category = await this.categoryRepo.findById(ref.categoryId);
    if (!category || !category.isActive) return null;

    const base = {
      categoryId: category.id.toString(),
      categoryCode: category.code,
      unitSource: category.unitSource,
      valued: category.valued,
      decimals: category.decimals,
    };

    if (category.unitSource === 'ACCOUNTING_CURRENCY') {
      const c = await this.currencies.byId(ref.unitId);
      if (!c) return null;
      return {
        ...base,
        unitId: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol || undefined,
        factorToBase: 1,
      };
    }

    const uom = await this.uomRepo.findById(ref.unitId);
    if (!uom || !uom.isActive || uom.categoryId !== base.categoryId) return null;
    return {
      ...base,
      unitId: uom.id.toString(),
      code: uom.code,
      name: uom.name,
      symbol: uom.symbol,
      factorToBase: uom.factorToBase,
    };
  }

  async listUnits(categoryId: string): Promise<ResolvedUnit[]> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category || !category.isActive) return [];
    const base = {
      categoryId: category.id.toString(),
      categoryCode: category.code,
      unitSource: category.unitSource,
      valued: category.valued,
      decimals: category.decimals,
    };
    if (category.unitSource === 'ACCOUNTING_CURRENCY') {
      const list = await this.currencies.list();
      return list.currencies.map((c) => ({
        ...base,
        unitId: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol || undefined,
        factorToBase: 1,
      }));
    }
    const uoms = await this.uomRepo.list();
    return uoms
      .filter((u) => u.isActive && u.categoryId === base.categoryId)
      .map((u) => ({
        ...base,
        unitId: u.id.toString(),
        code: u.code,
        name: u.name,
        symbol: u.symbol,
        factorToBase: u.factorToBase,
      }));
  }

  async fromInput(input: UnitInput): Promise<UnitRef | null> {
    if (input.unitCategoryId && input.unitId) {
      return { categoryId: input.unitCategoryId, unitId: input.unitId };
    }
    if (!input.uomId) return null;
    // Legacy: a retired currency uom, moved to accounting by the migration.
    const mapped = await this.uomRepo.findLegacyMapping(input.uomId);
    if (mapped) return { categoryId: mapped.unitCategoryId, unitId: mapped.unitId };
    // Legacy: a local uom id is still a unit — its category is on the row.
    const uom = await this.uomRepo.findById(input.uomId);
    if (uom) return { categoryId: uom.categoryId, unitId: uom.id.toString() };
    // Bridge: callers still holding one "unit id" (partner and bundle types)
    // may now pick an accounting currency — its category is the currency one.
    const currency = await this.currencies.byId(input.uomId);
    if (currency) {
      const category = (await this.categoryRepo.list()).find(
        (c) => c.isActive && c.unitSource === 'ACCOUNTING_CURRENCY',
      );
      if (category) return { categoryId: category.id.toString(), unitId: currency.id };
    }
    return null;
  }

  checkAmount(amount: number, unit: ResolvedUnit): string | null {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return 'amount must be a number';
    }
    const scaled = amount * 10 ** unit.decimals;
    if (Math.abs(Math.round(scaled) - scaled) > 1e-6) {
      return unit.decimals === 0
        ? `${unit.code} amounts must be whole numbers`
        : `${unit.code} amounts may have at most ${unit.decimals} decimal places`;
    }
    return null;
  }

  convert(amount: number, from: ResolvedUnit, to: ResolvedUnit): number {
    if (from.categoryId !== to.categoryId) {
      throw new UnitResolutionError(
        `Can't convert ${from.code} (${from.categoryCode}) to ${to.code} (${to.categoryCode})`,
      );
    }
    if (from.unitId === to.unitId) return amount;
    const scale = 10 ** to.decimals;
    // Via the base unit; the epsilon absorbs float noise (1 GB → exactly 1024 MB).
    const raw = (amount * from.factorToBase) / to.factorToBase;
    return Math.floor(raw * scale + 1e-9) / scale;
  }
}
