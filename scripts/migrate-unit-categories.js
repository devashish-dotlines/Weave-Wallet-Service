#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-off, idempotent migration to unit categories.
 *
 *   node scripts/migrate-unit-categories.js           # dry run (default): prints the plan, rolls back
 *   node scripts/migrate-unit-categories.js --apply   # does it, in ONE transaction
 *
 * Prerequisites:
 *   - `npm run build` and one start with DB_SYNC=true, so the new tables/columns
 *     exist (wlt_uom_category, wlt_balance_type_unit, wlt_uom_legacy_map,
 *     wlt_uom.category_id/factor_to_base, wlt_balance_type.category_id,
 *     wlt_wallet.unit_*, wlt_topup_request.unit_*).
 *   - Accounting running a build whose ListCurrencies returns `id`
 *     (currency units ARE acc_currency rows).
 *
 * What it does:
 *   1. Ensures the categories CURRENCY / POINTS / TIME / DATA.
 *   2. Every wlt_uom whose code is an accounting currency → recorded in
 *      wlt_uom_legacy_map (old uom id → CURRENCY + acc_currency id) and voided.
 *      Every other uom → category_id + factor_to_base (by code, see LOCAL_UNITS).
 *   3. Wallets and top-up requests → unit_category_id / unit_id / unit_code.
 *   4. Balance types → category_id; wlt_balance_type_uom links → wlt_balance_type_unit.
 *   5. Verifies every wallet has a unit its balance type allows; rolls back otherwise.
 *
 * Old uom_id columns are left in place (unused) for one release.
 */
require('dotenv').config();
const path = require('path');
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'system:migrate-unit-categories';

const CATEGORIES = [
  { code: 'CURRENCY', name: 'Currency', unitSource: 'ACCOUNTING_CURRENCY', valued: true, decimals: 2 },
  { code: 'POINTS', name: 'Points', unitSource: 'LOCAL', valued: true, decimals: 2, base: 'POINTS' },
  { code: 'TIME', name: 'Time', unitSource: 'LOCAL', valued: false, decimals: 0, base: 'MINUTE' },
  { code: 'DATA', name: 'Data', unitSource: 'LOCAL', valued: false, decimals: 0, base: 'MB' },
];

// Known LOCAL unit codes → category + factor to the category's base unit.
const LOCAL_UNITS = {
  POINTS: { category: 'POINTS', factor: 1 },
  POINT: { category: 'POINTS', factor: 1 },
  PTS: { category: 'POINTS', factor: 1 },
  SECOND: { category: 'TIME', factor: 1 / 60 },
  MINUTE: { category: 'TIME', factor: 1 },
  MINUTES: { category: 'TIME', factor: 1 },
  HOUR: { category: 'TIME', factor: 60 },
  KB: { category: 'DATA', factor: 1 / 1024 },
  MB: { category: 'DATA', factor: 1 },
  GB: { category: 'DATA', factor: 1024 },
};

const now = () => Math.floor(Date.now() / 1000);
const log = (...a) => console.log(...a);

async function currencies() {
  const { ledgerClient } = require(path.join(__dirname, '..', 'build', 'infra', 'grpc', 'clients', 'ledgerClient'));
  if (!ledgerClient) throw new Error('ACCOUNTING_GRPC_TARGET is not set in wallet/.env');
  const list = await ledgerClient.listCurrencies();
  if (list.currencies.some((c) => !c.id)) {
    throw new Error('Accounting returned currencies without an id — rebuild and restart accounting (gRPC) first');
  }
  return list.currencies;
}

async function main() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DEV_DB_NAME,
  });
  await db.connect();
  const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

  // Preconditions: the synced schema.
  const needed = [
    ['wlt_uom_category', 'code'],
    ['wlt_balance_type_unit', 'unit_id'],
    ['wlt_uom_legacy_map', 'legacy_uom_id'],
    ['wlt_uom', 'category_id'],
    ['wlt_balance_type', 'category_id'],
    ['wlt_wallet', 'unit_category_id'],
    ['wlt_topup_request', 'unit_category_id'],
  ];
  for (const [table, column] of needed) {
    const [{ n }] = await q(
      `select count(*)::int n from information_schema.columns where table_name=$1 and column_name=$2`,
      [table, column],
    );
    if (!n) throw new Error(`${table}.${column} missing — build the wallet and start it once with DB_SYNC=true`);
  }

  const accCurrencies = await currencies();
  const currencyByCode = new Map(accCurrencies.map((c) => [c.code, c]));
  log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${accCurrencies.length} accounting currencies (${accCurrencies.map((c) => c.code).join(', ')})\n`);

  await db.query('BEGIN');
  try {
    const ts = now();

    // 1. Categories
    log('Categories');
    const categoryId = {};
    for (const c of CATEGORIES) {
      const [row] = await q(`select id from wlt_uom_category where code=$1 and not voided`, [c.code]);
      if (row) {
        categoryId[c.code] = row.id;
        log(`  ✓ ${c.code}`);
        continue;
      }
      const id = randomUUID();
      await q(
        `insert into wlt_uom_category (id, code, name, unit_source, valued, decimals, is_active, voided,
           created_at, updated_at, created_by, updated_by, server_version)
         values ($1,$2,$3,$4,$5,$6,true,false,$7,$7,$8,$8,0)`,
        [id, c.code, c.name, c.unitSource, c.valued, c.decimals, ts, ACTOR],
      );
      categoryId[c.code] = id;
      log(`  + ${c.code} (${c.unitSource}, ${c.valued ? 'valued' : 'quantity only'}, ${c.decimals} dp)`);
    }

    // 2. Units
    log('\nUnits');
    const uoms = await q(`select id, code, category_id, voided from wlt_uom`);
    const unitOfUom = new Map(); // old uom id → { categoryId, unitId, unitCode }
    for (const u of uoms) {
      const code = u.code.toUpperCase();
      const mapped = (await q(`select * from wlt_uom_legacy_map where legacy_uom_id=$1`, [u.id]))[0];
      if (mapped) {
        unitOfUom.set(u.id, { categoryId: mapped.unit_category_id, unitId: mapped.unit_id, unitCode: mapped.unit_code });
        log(`  ✓ ${code} already moved to accounting currency`);
        continue;
      }
      const currency = currencyByCode.get(code);
      if (currency) {
        await q(
          `insert into wlt_uom_legacy_map (legacy_uom_id, unit_category_id, unit_id, unit_code, created_at)
           values ($1,$2,$3,$4,$5)`,
          [u.id, categoryId.CURRENCY, currency.id, code, ts],
        );
        await q(
          `update wlt_uom set voided=true, deleted_at=$2, deleted_by=$3, updated_at=$2, updated_by=$3 where id=$1`,
          [u.id, ts, ACTOR],
        );
        unitOfUom.set(u.id, { categoryId: categoryId.CURRENCY, unitId: currency.id, unitCode: code });
        log(`  → ${code}: currency — now accounting's acc_currency ${currency.id}; wallet uom voided`);
        continue;
      }
      if (u.voided) continue;
      const local = LOCAL_UNITS[code];
      if (!local) {
        throw new Error(`Unit ${code} is neither an accounting currency nor a known local unit — add it to LOCAL_UNITS`);
      }
      if (!u.category_id) {
        await q(
          `update wlt_uom set category_id=$2, factor_to_base=$3, updated_at=$4, updated_by=$5 where id=$1`,
          [u.id, categoryId[local.category], local.factor, ts, ACTOR],
        );
        log(`  + ${code}: ${local.category}, factor ${local.factor}`);
      } else {
        log(`  ✓ ${code}: already categorised`);
      }
      unitOfUom.set(u.id, { categoryId: u.category_id || categoryId[local.category], unitId: u.id, unitCode: code });
    }

    // Base units for LOCAL categories.
    for (const c of CATEGORIES.filter((x) => x.base)) {
      const [base] = await q(`select id from wlt_uom where code=$1 and not voided`, [c.base]);
      if (!base) continue;
      const r = await db.query(
        `update wlt_uom_category set base_uom_id=$2, updated_at=$3, updated_by=$4 where id=$1 and base_uom_id is null`,
        [categoryId[c.code], base.id, ts, ACTOR],
      );
      if (r.rowCount) log(`  + ${c.code} base unit = ${c.base}`);
    }

    // 3. Wallets and top-up requests
    for (const table of ['wlt_wallet', 'wlt_topup_request']) {
      log(`\n${table}`);
      const rows = await q(`select id, uom_id from ${table} where unit_id is null and uom_id is not null`);
      for (const r of rows) {
        const unit = unitOfUom.get(r.uom_id);
        if (!unit) throw new Error(`${table} ${r.id}: uom ${r.uom_id} has no unit mapping`);
        await q(
          `update ${table} set unit_category_id=$2, unit_id=$3, unit_code=$4 where id=$1`,
          [r.id, unit.categoryId, unit.unitId, unit.unitCode],
        );
      }
      log(`  ${rows.length ? `+ ${rows.length} row(s) given a unit` : '✓ nothing to move'}`);
    }

    // 4. Balance types
    log('\nBalance types');
    const bts = await q(`select id, code, category_id from wlt_balance_type where not voided`);
    for (const bt of bts) {
      const links = await q(
        `select uom_id from wlt_balance_type_uom where balance_type_id=$1 and not voided`,
        [bt.id],
      );
      const units = links.map((l) => unitOfUom.get(l.uom_id)).filter(Boolean);
      const cats = [...new Set(units.map((u) => u.categoryId))];
      let cat = bt.category_id;
      if (!cat) {
        if (cats.length !== 1) {
          throw new Error(
            `Balance type ${bt.code}: can't infer a category from its units (${units.map((u) => u.unitCode).join(', ') || 'none'})`,
          );
        }
        cat = cats[0];
        await q(`update wlt_balance_type set category_id=$2, updated_at=$3, updated_by=$4 where id=$1`, [bt.id, cat, ts, ACTOR]);
      }
      let added = 0;
      for (const u of units) {
        const exists = await q(
          `select 1 from wlt_balance_type_unit where balance_type_id=$1 and unit_id=$2`,
          [bt.id, u.unitId],
        );
        if (exists.length) continue;
        await q(
          `insert into wlt_balance_type_unit (id, balance_type_id, unit_id, voided, created_at, updated_at, created_by, updated_by, server_version)
           values ($1,$2,$3,false,$4,$4,$5,$5,0)`,
          [randomUUID(), bt.id, u.unitId, ts, ACTOR],
        );
        added++;
      }
      const catCode = CATEGORIES.find((c) => categoryId[c.code] === cat)?.code ?? cat;
      log(`  ${bt.category_id ? '✓' : '+'} ${bt.code} → ${catCode} [${units.map((u) => u.unitCode).join(', ')}]${added ? ` (${added} link(s) copied)` : ''}`);
    }

    // 5. Verify
    log('\nVerify');
    const orphans = await q(`select code from wlt_wallet where not voided and (unit_id is null or unit_category_id is null)`);
    if (orphans.length) throw new Error(`Wallets without a unit: ${orphans.map((o) => o.code).join(', ')}`);
    const disallowed = await q(`
      select w.code, w.unit_code, bt.code as bt
        from wlt_wallet w
        join wlt_wallet_type wt on wt.id = w.wallet_type_id
        join wlt_balance_type bt on bt.id = wt.balance_type_id
       where not w.voided
         and (bt.category_id is distinct from w.unit_category_id
              or (exists (select 1 from wlt_balance_type_unit l where l.balance_type_id = bt.id and not l.voided)
                  and not exists (select 1 from wlt_balance_type_unit l where l.balance_type_id = bt.id and not l.voided and l.unit_id = w.unit_id)))`);
    if (disallowed.length) {
      throw new Error(`Wallets whose unit their balance type doesn't allow: ${disallowed.map((d) => `${d.code} (${d.unit_code} in ${d.bt})`).join(', ')}`);
    }
    const [{ n }] = await q(`select count(*)::int n from wlt_wallet where not voided`);
    log(`  ✓ all ${n} wallet(s) hold a unit their balance type allows`);

    if (APPLY) {
      await db.query('COMMIT');
      log('\nCommitted.');
    } else {
      await db.query('ROLLBACK');
      log('\nDry run — rolled back. Re-run with --apply.');
    }
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    await db.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  });
