require('dotenv').config();

// Idempotent wallet seed (NFR-6): default balance types and units of measure.
// Safe to re-run — every item is keyed by its natural unique `code` and skipped
// when already present. Run with `npm run seed`.
import './infra/sequelize';
import { DateTimeObject } from './modules/Core/domain/dateTimeObject';
import {
  balanceTypeRepo,
  uomRepo,
  uomCategoryRepo,
  ownerTypeRepo,
  usageDimensionRepo,
} from './modules/Wallet/repos';
import { currencyCatalog } from './modules/Wallet/services';
import { UomCategory, UnitSource } from './modules/Wallet/domain/uomCategory';
import { walletTypeRepo } from './modules/Wallet/repos';
import { BalanceType } from './modules/Wallet/domain/balanceType';
import { WalletType, WalletCategory } from './modules/Wallet/domain/walletType';
import { Uom } from './modules/Wallet/domain/uom';
import { OwnerType } from './modules/Wallet/domain/ownerType';
import { UsageDimension } from './modules/Wallet/domain/usageDimension';

const SYSTEM_ACTOR = 'system';
const now = () => DateTimeObject.create(-1).getValue();

interface CategorySeed {
  code: string;
  name: string;
  unitSource: UnitSource;
  valued: boolean;
  decimals: number;
  /** LOCAL only: the unit code whose factor is 1. */
  baseUomCode?: string;
}

interface BalanceTypeSeed {
  code: string;
  name: string;
  description?: string;
  categoryCode: string;
  /**
   * Unit codes of that category — currency codes for CURRENCY (resolved to
   * acc_currency ids through accounting), UOM codes otherwise. Empty ⇒ any
   * unit of the category.
   */
  allowedUnitCodes: string[];
}

interface UomSeed {
  code: string;
  name: string;
  symbol?: string;
  categoryCode: string;
  factorToBase: number;
}

interface OwnerTypeSeed {
  code: string;
  name: string;
  description?: string;
}

const CATEGORIES: CategorySeed[] = [
  { code: 'CURRENCY', name: 'Currency', unitSource: 'ACCOUNTING_CURRENCY', valued: true, decimals: 2 },
  { code: 'POINTS', name: 'Points', unitSource: 'LOCAL', valued: true, decimals: 2, baseUomCode: 'POINTS' },
  { code: 'TIME', name: 'Time', unitSource: 'LOCAL', valued: false, decimals: 0, baseUomCode: 'MINUTE' },
  { code: 'DATA', name: 'Data', unitSource: 'LOCAL', valued: false, decimals: 0, baseUomCode: 'MB' },
];

const BALANCE_TYPES: BalanceTypeSeed[] = [
  {
    code: 'CASH',
    name: 'Cash',
    description: 'Stored monetary value',
    categoryCode: 'CURRENCY',
    allowedUnitCodes: ['BDT', 'USD', 'MYR'],
  },
  {
    code: 'POINTS',
    name: 'Points',
    description: 'Loyalty points',
    categoryCode: 'POINTS',
    allowedUnitCodes: ['POINTS'],
  },
  {
    code: 'REWARD',
    name: 'Reward',
    description: 'Reward credits',
    categoryCode: 'POINTS',
    allowedUnitCodes: ['POINTS'],
  },
  {
    code: 'TALKTIME',
    name: 'Talk time',
    description: 'Voice minutes',
    categoryCode: 'TIME',
    allowedUnitCodes: [],
  },
  {
    code: 'DATA',
    name: 'Data',
    description: 'Mobile data allowance',
    categoryCode: 'DATA',
    allowedUnitCodes: [],
  },
];

// Currencies are NOT here: CURRENCY units are accounting's acc_currency rows.
const UOMS: UomSeed[] = [
  { code: 'POINTS', name: 'Points', categoryCode: 'POINTS', factorToBase: 1 },
  { code: 'MINUTE', name: 'Minute', symbol: 'min', categoryCode: 'TIME', factorToBase: 1 },
  { code: 'HOUR', name: 'Hour', symbol: 'h', categoryCode: 'TIME', factorToBase: 60 },
  { code: 'MB', name: 'Mega Byte', symbol: 'MB', categoryCode: 'DATA', factorToBase: 1 },
  { code: 'GB', name: 'Giga Byte', symbol: 'GB', categoryCode: 'DATA', factorToBase: 1024 },
];

interface UsageDimensionSeed {
  key: string;
  name: string;
  description?: string;
  dataType: 'single_select' | 'multi_select' | 'string' | 'boolean' | 'integer' | 'decimal';
  options?: { key: string; value: string }[];
}

/**
 * Restriction axes. Nothing else in the workspace defines call types or time
 * bands, so THESE KEYS ARE CANONICAL — whatever eventually sends a usage
 * context at spend time must use exactly these.
 */
const USAGE_DIMENSIONS: UsageDimensionSeed[] = [
  {
    key: 'call_type',
    name: 'Call type',
    description: 'The kind of call a balance may be spent on',
    dataType: 'single_select',
    options: [
      { key: 'LOCAL', value: 'Local' },
      { key: 'STD', value: 'STD (national)' },
      { key: 'ISD', value: 'ISD (international)' },
      { key: 'ON_NET', value: 'On-net' },
      { key: 'OFF_NET', value: 'Off-net' },
    ],
  },
  {
    key: 'time_band',
    name: 'Time band',
    description:
      'When a balance may be spent. The wallet compares the key it is given — the caller decides which band applies',
    dataType: 'single_select',
    options: [
      { key: 'PEAK', value: 'Peak' },
      { key: 'OFF_PEAK', value: 'Off-peak' },
      { key: 'WEEKEND', value: 'Weekend' },
    ],
  },
  {
    key: 'bundle',
    name: 'Bundle',
    description:
      'An OPEN dimension — no fixed value list, so the bundle is typed on the wallet screen',
    dataType: 'string',
  },
];

interface WalletTypeSeed {
  name: string;
  description?: string;
  category: WalletCategory;
  /** Resolved to an id at seed time; the balance type must already be seeded. */
  balanceTypeCode: string;
  allowTransfersOut: boolean;
  allowWithdrawals: boolean;
  /** May wallets of this type be topped up? Defaults to prepaid only. */
  allowTopup?: boolean;
}

/**
 * Wallet types the rest of the platform names by configuration rather than by
 * id. `wlt_wallet_type` has no `code` column, so the NAME is the natural key —
 * renaming one here makes the seeder create a second row instead of skipping.
 */
const WALLET_TYPES: WalletTypeSeed[] = [
  {
    name: 'Individual Partner Wallet',
    description:
      'Commission wallet for a partner who has no organization of their own (a freelance sales person)',
    category: 'prepaid',
    balanceTypeCode: 'CASH',
    // Commission is earned to be paid out, so withdrawals are open; partner-to-
    // partner transfers are not part of the flow.
    allowTransfersOut: false,
    allowWithdrawals: true,
  },
  {
    name: 'Partner Wallet',
    description:
      'Commission wallet for a partner organization, held by the organization rather than a person',
    category: 'prepaid',
    balanceTypeCode: 'CASH',
    // Same payout rules as the individual wallet for now. A separate type so the
    // two can diverge (limits, KYC, transfers) without affecting each other.
    allowTransfersOut: false,
    allowWithdrawals: true,
  },
];

const OWNER_TYPES: OwnerTypeSeed[] = [
  { code: 'CUSTOMER', name: 'Customer', description: 'Customer-owned wallet' },
  { code: 'PARTNER', name: 'Partner', description: 'Partner-owned wallet' },
  { code: 'USER', name: 'User', description: 'Internal user-owned wallet' },
  // owner_id is an accounts organization id. A partner organization's wallet
  // uses this; a partner with no organization of its own is owned as USER.
  {
    code: 'ORGANIZATION',
    name: 'Organization',
    description: 'Organization-owned wallet (owner id is an accounts organization id)',
  },
];

async function categoryId(code: string): Promise<string> {
  const c = await uomCategoryRepo.findByCode(code);
  if (!c) throw new Error(`seed: unknown unit category ${code}`);
  return c.id.toString();
}

/** Categories first (without base units — those don't exist yet). */
async function seedCategories(): Promise<void> {
  for (const c of CATEGORIES) {
    if (await uomCategoryRepo.findByCode(c.code)) {
      console.log(`[seed] unit category ${c.code} already present — skip`);
      continue;
    }
    const ts = now();
    const created = UomCategory.create({
      code: c.code,
      name: c.name,
      unitSource: c.unitSource,
      valued: c.valued,
      decimals: c.decimals,
      isActive: true,
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) throw new Error(`seed category ${c.code}: ${created.error}`);
    await uomCategoryRepo.create(created.getValue());
    console.log(`[seed] unit category ${c.code} created`);
  }
}

/** After the UOMs exist: point each LOCAL category at its base unit, if unset. */
async function linkCategoryBases(): Promise<void> {
  for (const c of CATEGORIES) {
    if (!c.baseUomCode) continue;
    const category = await uomCategoryRepo.findByCode(c.code);
    const base = await uomRepo.findByCode(c.baseUomCode);
    if (!category || !base || category.baseUomId) continue;
    category.baseUomId = base.id.toString();
    await uomCategoryRepo.update(category);
    console.log(`[seed] unit category ${c.code} base unit = ${c.baseUomCode}`);
  }
}

/** Unit codes → unit ids within a category (accounting currencies or UOMs). */
async function unitIds(categoryCode: string, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  if (categoryCode === 'CURRENCY') {
    const ids: string[] = [];
    for (const code of codes) {
      let currency;
      try {
        currency = await currencyCatalog.byCode(code);
      } catch (err) {
        // Accounting down: seed the balance type as "any currency" rather than
        // fail — tighten the list later from the panel.
        console.warn(`[seed] accounting unreachable (${(err as Error).message}); ${categoryCode} balance type allows any currency`);
        return [];
      }
      if (!currency) {
        console.warn(`[seed] currency ${code} not in accounting — left out`);
        continue;
      }
      ids.push(currency.id);
    }
    return ids;
  }
  const ids: string[] = [];
  for (const code of codes) {
    const uom = await uomRepo.findByCode(code);
    if (!uom) throw new Error(`seed: unknown uom ${code}`);
    ids.push(uom.id.toString());
  }
  return ids;
}

async function seedBalanceTypes(): Promise<void> {
  for (const b of BALANCE_TYPES) {
    if (await balanceTypeRepo.findByCode(b.code)) {
      console.log(`[seed] balance type ${b.code} already present — skip`);
      continue;
    }
    const ts = now();
    const created = BalanceType.create({
      name: b.name,
      code: b.code,
      description: b.description,
      isActive: true,
      categoryId: await categoryId(b.categoryCode),
      allowedUnitIds: await unitIds(b.categoryCode, b.allowedUnitCodes),
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) {
      throw new Error(`seed balance type ${b.code}: ${created.error}`);
    }
    await balanceTypeRepo.create(created.getValue());
    console.log(`[seed] balance type ${b.code} created`);
  }
}

async function seedUoms(): Promise<void> {
  for (const u of UOMS) {
    if (await uomRepo.findByCode(u.code)) {
      console.log(`[seed] uom ${u.code} already present — skip`);
      continue;
    }
    const ts = now();
    const created = Uom.create({
      name: u.name,
      code: u.code,
      symbol: u.symbol,
      categoryId: await categoryId(u.categoryCode),
      factorToBase: u.factorToBase,
      isActive: true,
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) throw new Error(`seed uom ${u.code}: ${created.error}`);
    await uomRepo.create(created.getValue());
    console.log(`[seed] uom ${u.code} created`);
  }
}

async function seedWalletTypes(): Promise<void> {
  for (const w of WALLET_TYPES) {
    if (await walletTypeRepo.findByName(w.name)) {
      console.log(`[seed] wallet type "${w.name}" already present — skip`);
      continue;
    }

    const balanceType = await balanceTypeRepo.findByCode(w.balanceTypeCode);
    if (!balanceType) {
      throw new Error(
        `seed wallet type "${w.name}": unknown balance type ${w.balanceTypeCode}`,
      );
    }

    const ts = now();
    const created = WalletType.create({
      name: w.name,
      description: w.description,
      category: w.category,
      balanceTypeId: balanceType.id.toString(),
      overdraftAllowed: false,
      allowTransfersOut: w.allowTransfersOut,
      allowTopup: w.allowTopup ?? w.category === 'prepaid',
      allowWithdrawals: w.allowWithdrawals,
      requiredKycLevel: 0,
      isActive: true,
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) {
      throw new Error(`seed wallet type "${w.name}": ${created.error}`);
    }
    await walletTypeRepo.create(created.getValue());
    console.log(`[seed] wallet type "${w.name}" created`);
  }
}

async function seedOwnerTypes(): Promise<void> {
  for (const o of OWNER_TYPES) {
    if (await ownerTypeRepo.findByCode(o.code)) {
      console.log(`[seed] owner type ${o.code} already present — skip`);
      continue;
    }
    const ts = now();
    const created = OwnerType.create({
      name: o.name,
      code: o.code,
      description: o.description,
      isActive: true,
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) {
      throw new Error(`seed owner type ${o.code}: ${created.error}`);
    }
    await ownerTypeRepo.create(created.getValue());
    console.log(`[seed] owner type ${o.code} created`);
  }
}

async function seedUsageDimensions(): Promise<void> {
  for (const d of USAGE_DIMENSIONS) {
    if (await usageDimensionRepo.findByKey(d.key)) {
      console.log(`[seed] usage dimension ${d.key} already present — skip`);
      continue;
    }
    const ts = now();
    const created = UsageDimension.create({
      name: d.name,
      key: d.key,
      description: d.description,
      dataType: d.dataType,
      options: d.options ?? [],
      isActive: true,
      createdBy: SYSTEM_ACTOR,
      updatedBy: SYSTEM_ACTOR,
      createdAt: ts,
      updatedAt: ts,
    });
    if (created.isFailure) {
      throw new Error(`seed usage dimension ${d.key}: ${created.error}`);
    }
    await usageDimensionRepo.create(created.getValue());
    console.log(`[seed] usage dimension ${d.key} created`);
  }
}

(async () => {
  try {
    console.log('[seed] starting wallet seed…');
    // Categories → UOMs (each names its category) → category base units →
    // balance types (each names a category and resolves unit codes).
    await seedCategories();
    await seedUoms();
    await linkCategoryBases();
    await seedBalanceTypes();
    // Balance types before wallet types — each wallet type resolves one by code.
    await seedWalletTypes();
    await seedOwnerTypes();
    await seedUsageDimensions();
    console.log('[seed] done.');
    process.exit(0);
  } catch (err) {
    console.error('[seed] failed:', err);
    process.exit(1);
  }
})();
