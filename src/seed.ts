require('dotenv').config();

// Idempotent wallet seed (NFR-6): default balance types and units of measure.
// Safe to re-run — every item is keyed by its natural unique `code` and skipped
// when already present. Run with `npm run seed`.
import './infra/sequelize';
import { DateTimeObject } from './modules/Core/domain/dateTimeObject';
import {
  balanceTypeRepo,
  uomRepo,
  ownerTypeRepo,
  usageDimensionRepo,
} from './modules/Wallet/repos';
import { walletTypeRepo } from './modules/Wallet/repos';
import { BalanceType } from './modules/Wallet/domain/balanceType';
import { WalletType, WalletCategory } from './modules/Wallet/domain/walletType';
import { Uom } from './modules/Wallet/domain/uom';
import { OwnerType } from './modules/Wallet/domain/ownerType';
import { UsageDimension } from './modules/Wallet/domain/usageDimension';

const SYSTEM_ACTOR = 'system';
const now = () => DateTimeObject.create(-1).getValue();

interface BalanceTypeSeed {
  code: string;
  name: string;
  description?: string;
  /** UOM codes this balance type may be denominated in. Empty ⇒ unrestricted. */
  allowedUomCodes: string[];
}

interface UomSeed {
  code: string;
  name: string;
  symbol?: string;
}

interface OwnerTypeSeed {
  code: string;
  name: string;
  description?: string;
}

const BALANCE_TYPES: BalanceTypeSeed[] = [
  {
    code: 'CASH',
    name: 'Cash',
    description: 'Stored monetary value',
    allowedUomCodes: ['BDT', 'USD'],
  },
  {
    code: 'POINTS',
    name: 'Points',
    description: 'Loyalty points',
    allowedUomCodes: ['POINTS'],
  },
  {
    code: 'REWARD',
    name: 'Reward',
    description: 'Reward credits',
    allowedUomCodes: ['POINTS'],
  },
];

const UOMS: UomSeed[] = [
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'POINTS', name: 'Points' },
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
];

const OWNER_TYPES: OwnerTypeSeed[] = [
  { code: 'CUSTOMER', name: 'Customer', description: 'Customer-owned wallet' },
  { code: 'PARTNER', name: 'Partner', description: 'Partner-owned wallet' },
  { code: 'USER', name: 'User', description: 'Internal user-owned wallet' },
];

async function seedBalanceTypes(): Promise<void> {
  for (const b of BALANCE_TYPES) {
    if (await balanceTypeRepo.findByCode(b.code)) {
      console.log(`[seed] balance type ${b.code} already present — skip`);
      continue;
    }
    // UOMs are seeded first, so every tagged code resolves here.
    const allowedUomIds: string[] = [];
    for (const uomCode of b.allowedUomCodes) {
      const uom = await uomRepo.findByCode(uomCode);
      if (!uom) throw new Error(`seed balance type ${b.code}: unknown uom ${uomCode}`);
      allowedUomIds.push(uom.id.toString());
    }

    const ts = now();
    const created = BalanceType.create({
      name: b.name,
      code: b.code,
      description: b.description,
      isActive: true,
      allowedUomIds,
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
    // UOMs before balance types — the balance-type tags resolve UOMs by code.
    await seedUoms();
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
