require('dotenv').config();

// Idempotent wallet seed (NFR-6): default balance types and units of measure.
// Safe to re-run — every item is keyed by its natural unique `code` and skipped
// when already present. Run with `npm run seed`.
import './infra/sequelize';
import { DateTimeObject } from './modules/Core/domain/dateTimeObject';
import { balanceTypeRepo, uomRepo, ownerTypeRepo } from './modules/Wallet/repos';
import { BalanceType } from './modules/Wallet/domain/balanceType';
import { Uom } from './modules/Wallet/domain/uom';
import { OwnerType } from './modules/Wallet/domain/ownerType';

const SYSTEM_ACTOR = 'system';
const now = () => DateTimeObject.create(-1).getValue();

interface BalanceTypeSeed {
  code: string;
  name: string;
  description?: string;
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
  { code: 'CASH', name: 'Cash', description: 'Stored monetary value' },
  { code: 'POINTS', name: 'Points', description: 'Loyalty points' },
  { code: 'REWARD', name: 'Reward', description: 'Reward credits' },
];

const UOMS: UomSeed[] = [
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'POINTS', name: 'Points' },
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
    const ts = now();
    const created = BalanceType.create({
      name: b.name,
      code: b.code,
      description: b.description,
      isActive: true,
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

(async () => {
  try {
    console.log('[seed] starting wallet seed…');
    await seedBalanceTypes();
    await seedUoms();
    await seedOwnerTypes();
    console.log('[seed] done.');
    process.exit(0);
  } catch (err) {
    console.error('[seed] failed:', err);
    process.exit(1);
  }
})();
