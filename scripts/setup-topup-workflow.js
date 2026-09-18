#!/usr/bin/env node
/**
 * Configure the workflow engine for wallet top-up approvals — idempotently.
 *
 * Creates (only what is missing, matched by slug / from→to):
 *   1. engine module `wallet` (gRPC target = this wallet's gRPC server, with a
 *      wallet-issued service key so the engine can push status + dispatch actions)
 *   2. workflow type `wallet-topup-approval` (entity type `wallet_topup_request`)
 *   3. statuses: submitted → under-review → approved → credited, rejected, cancelled
 *   4. transition rules (reviewers: Admin role; cancel: any role)
 *   5. gRPC action `credit-wallet-topup`, template, and the action rule on
 *      `→ approved` that advances to `credited` on success
 *   6. wallet .env: WORKFLOW_GRPC_TARGET, WORKFLOW_API_KEY, TOPUP_REQUEST_TYPE_ID
 *
 * Dry run by default (reads only, prints the plan). `--apply` writes.
 *
 * Usage:
 *   WF_TOKEN=<bearer token> node scripts/setup-topup-workflow.js            # dry run
 *   WF_TOKEN=<bearer token> node scripts/setup-topup-workflow.js --apply
 *
 * Env (defaults match local dev):
 *   WF_TOKEN                gateway JWT with workflow.* / actions.* permissions (required)
 *   WALLET_TOKEN            JWT with wallet.service.manage (defaults to WF_TOKEN)
 *   ENGINE_URL              http://127.0.0.1:9045/api/v1
 *   ENGINE_GRPC_TARGET      127.0.0.1:50051   (written to wallet .env)
 *   WALLET_URL              http://127.0.0.1:9046/api/v1/wallet
 *   WALLET_GRPC_TARGET      127.0.0.1:50072   (what the engine dials)
 *   REVIEWER_ROLE_ID        7565dc06-c34e-4503-97bd-84291b964a96  (Accounts "Admin")
 *   WALLET_ENGINE_SERVICE_KEY  reuse an existing wallet service key instead of issuing one
 *
 * Secrets are never printed: generated keys go straight into wallet/.env.
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ENGINE_URL = process.env.ENGINE_URL || 'http://127.0.0.1:9045/api/v1';
const ENGINE_GRPC_TARGET = process.env.ENGINE_GRPC_TARGET || '127.0.0.1:50051';
const WALLET_URL = process.env.WALLET_URL || 'http://127.0.0.1:9046/api/v1/wallet';
const WALLET_GRPC_TARGET = process.env.WALLET_GRPC_TARGET || '127.0.0.1:50072';
const REVIEWER_ROLE_ID =
  process.env.REVIEWER_ROLE_ID || '7565dc06-c34e-4503-97bd-84291b964a96';
const WF_TOKEN = process.env.WF_TOKEN;
const WALLET_TOKEN = process.env.WALLET_TOKEN || WF_TOKEN;
const ENV_PATH = path.resolve(__dirname, '..', '.env');

const MODULE = { slug: process.env.WALLET_MODULE_SLUG || 'wallet-service', name: 'Wallet Service', description: 'Wallet service (wallets, top-ups, transfers)' };
const TYPE = {
  slug: 'wallet-topup-approval',
  name: 'Wallet top-up approval',
  entityType: 'wallet_topup_request', // contract with wallet: TOPUP_REQUEST_ENTITY
  description: 'Manual bank-deposit top-up requests reviewed before the wallet is credited',
};
// Slugs approved/rejected/cancelled are a contract with wallet (TOPUP_STATUS_SLUGS).
const STATUSES = [
  { slug: 'submitted', name: 'Submitted', isInitial: true, isTerminal: false, sortOrder: 1, color: '#3b82f6', actionLabel: 'Submit' },
  { slug: 'under-review', name: 'Under review', isInitial: false, isTerminal: false, sortOrder: 2, color: '#f59e0b', actionLabel: 'Start review' },
  { slug: 'approved', name: 'Approved', isInitial: false, isTerminal: false, sortOrder: 3, color: '#10b981', actionLabel: 'Approve' },
  { slug: 'credited', name: 'Credited', isInitial: false, isTerminal: true, sortOrder: 13, color: '#033022', actionLabel: 'Credit' },
  { slug: 'rejected', name: 'Rejected', isInitial: false, isTerminal: true, sortOrder: 23, color: '#ef4444', actionLabel: 'Reject', requiresNote: true },
  { slug: 'cancelled', name: 'Cancelled', isInitial: false, isTerminal: true, sortOrder: 33, color: '#6b7280', actionLabel: 'Cancel' },
];
const RULES = [
  // Reviewers
  { from: 'submitted', to: 'under-review', role: REVIEWER_ROLE_ID },
  { from: 'submitted', to: 'approved', role: REVIEWER_ROLE_ID },
  { from: 'submitted', to: 'rejected', role: REVIEWER_ROLE_ID },
  { from: 'under-review', to: 'approved', role: REVIEWER_ROLE_ID },
  { from: 'under-review', to: 'rejected', role: REVIEWER_ROLE_ID },
  // Follow-up after a successful credit. The engine runs it as the system actor
  // (role not checked), so restricting it to reviewers keeps humans from
  // marking a request credited without the wallet actually crediting it.
  { from: 'approved', to: 'credited', role: REVIEWER_ROLE_ID },
  // Owner withdraws before review; the wallet checks ownership.
  { from: 'submitted', to: 'cancelled', role: null },
];
const ACTION = {
  slug: 'credit-wallet-topup', // contract with wallet: CREDIT_TOPUP_ACTION
  name: 'Credit approved wallet top-up',
  actionType: 'grpc',
  endpointUrl: '',
  retryStrategy: 'exponential',
  // Retries also absorb the race where the engine dispatches before the wallet
  // has saved APPROVED locally.
  maxRetries: 5,
  timeoutSeconds: 30,
};
const TEMPLATE = {
  slug: 'wallet-topup-approval-side-effects',
  name: 'Wallet top-up approval side effects',
  description: 'Credits the wallet when a top-up request is approved',
};

// ---------------------------------------------------------------------------

const log = (...a) => console.log(...a);
const plan = [];

async function call(base, token, method, pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || text;
    throw new Error(`${method} ${pathname} → ${res.status}: ${msg}`);
  }
  return data;
}
const engine = (m, p, b) => call(ENGINE_URL, WF_TOKEN, m, p, b);
const wallet = (m, p, b) => call(WALLET_URL, WALLET_TOKEN, m, p, b);
const rows = (d) => (Array.isArray(d) ? d : d?.items ?? d?.data ?? d?.rows ?? []);
/** Create endpoints return the new id (string) or the created object. */
const idOf = (d) => (typeof d === 'string' ? d : d?.id);

async function ensure(label, findExisting, create) {
  const existing = await findExisting();
  if (existing) {
    log(`  ✓ ${label} exists`);
    return existing;
  }
  plan.push(label);
  if (!APPLY) {
    log(`  + ${label} (would create)`);
    return null;
  }
  const created = await create();
  log(`  + ${label} created`);
  return created;
}

function upsertEnv(updates) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const backup = `${ENV_PATH}.bak-${Date.now()}`;
  if (text) fs.writeFileSync(backup, text, { mode: 0o600 });
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, text);
  return backup;
}

async function main() {
  if (!WF_TOKEN) {
    console.error('WF_TOKEN is required (a gateway JWT with workflow/actions admin permissions).');
    process.exit(2);
  }
  log(`${APPLY ? 'APPLY' : 'DRY RUN'} — engine ${ENGINE_URL}, wallet ${WALLET_URL}\n`);
  const envUpdates = {};

  // 1. Module -----------------------------------------------------------------
  log('Module');
  let mod = rows(await engine('GET', '/workflow/modules')).find((m) => m.slug === MODULE.slug);
  if (mod) {
    log(`  ✓ module '${MODULE.slug}' exists (${mod.id})`);
    if (mod.grpcTarget !== WALLET_GRPC_TARGET || !mod.grpcApiKeySet) {
      log(`  ! module gRPC wiring incomplete (target=${mod.grpcTarget ?? 'none'}, key set=${!!mod.grpcApiKeySet})`);
      plan.push('update module gRPC target/key');
      if (APPLY) {
        const grpcApiKey = mod.grpcApiKeySet ? undefined : await issueWalletServiceKey();
        await engine('PUT', `/workflow/modules/${mod.id}`, {
          grpcTarget: WALLET_GRPC_TARGET,
          ...(grpcApiKey ? { grpcApiKey } : {}),
        });
        log('  + module gRPC wiring updated');
      }
    }
  } else {
    plan.push(`module '${MODULE.slug}'`);
    if (APPLY) {
      const grpcApiKey = await issueWalletServiceKey();
      const created = await engine('POST', '/workflow/modules', {
        ...MODULE,
        grpcTarget: WALLET_GRPC_TARGET,
        grpcApiKey,
        isActive: true,
      });
      mod = rows(await engine('GET', '/workflow/modules')).find((m) => m.slug === MODULE.slug) ??
        { id: idOf(created) };
      log(`  + module '${MODULE.slug}' created (${mod.id})`);
    } else {
      log(`  + module '${MODULE.slug}' (would create, issuing a wallet service key for the engine)`);
    }
  }
  if (mod?.apiKey) envUpdates.WORKFLOW_API_KEY = mod.apiKey;
  envUpdates.WORKFLOW_GRPC_TARGET = ENGINE_GRPC_TARGET;
  if (mod?.id) envUpdates.WORKFLOW_MODULE_ID = mod.id;

  // 2. Workflow type ------------------------------------------------------------
  log('\nWorkflow type');
  const typeRows = mod?.id ? rows(await engine('GET', `/workflow/types?moduleId=${mod.id}`)) : [];
  const type = await ensure(
    `type '${TYPE.slug}' (${TYPE.entityType})`,
    async () => typeRows.find((t) => t.slug === TYPE.slug || t.entityType === TYPE.entityType),
    async () => {
      const created = await engine('POST', '/workflow/types', { ...TYPE, moduleId: mod.id, isActive: true });
      return { id: idOf(created) };
    },
  );
  if (type?.id) envUpdates.TOPUP_REQUEST_TYPE_ID = type.id;

  // 3. Statuses -----------------------------------------------------------------
  log('\nStatuses');
  const statusBySlug = new Map();
  if (type?.id) {
    for (const s of rows(await engine('GET', `/workflow/statuses?workflowTypeId=${type.id}`))) {
      statusBySlug.set(s.slug, s);
    }
  }
  for (const s of STATUSES) {
    const st = await ensure(
      `status '${s.slug}'`,
      async () => statusBySlug.get(s.slug),
      async () => {
        const created = await engine('POST', '/workflow/statuses', {
          ...s,
          workflowTypeId: type.id,
          isActive: true,
          requiresNote: s.requiresNote ?? false,
        });
        return { id: idOf(created), slug: s.slug };
      },
    );
    if (st) statusBySlug.set(s.slug, st);
  }
  const sid = (slug) => statusBySlug.get(slug)?.id;

  // 4. Transition rules ---------------------------------------------------------
  log('\nTransition rules');
  const existingRules = type?.id
    ? rows(await engine('GET', `/workflow/transition-rules?workflowTypeId=${type.id}`))
    : [];
  for (const r of RULES) {
    await ensure(
      `rule ${r.from} → ${r.to} (${r.role ? 'reviewer role' : 'any role'})`,
      async () =>
        existingRules.find(
          (x) =>
            x.fromStatusId === sid(r.from) &&
            x.toStatusId === sid(r.to) &&
            (x.roleId ?? null) === r.role,
        ),
      async () =>
        engine('POST', '/workflow/transition-rules', {
          workflowTypeId: type.id,
          fromStatusId: sid(r.from),
          toStatusId: sid(r.to),
          roleId: r.role,
          isActive: true,
        }),
    );
  }

  // 5. Action, template, action rule --------------------------------------------
  log('\nActions');
  const actionRows = mod?.id ? rows(await engine('GET', `/actions/definitions?moduleId=${mod.id}`)) : [];
  const action = await ensure(
    `action '${ACTION.slug}' (gRPC)`,
    async () => actionRows.find((a) => a.slug === ACTION.slug),
    async () => {
      const created = await engine('POST', '/actions/definitions', { ...ACTION, moduleId: mod.id, isActive: true });
      return { id: idOf(created) };
    },
  );
  const templateRows = mod?.id ? rows(await engine('GET', `/actions/templates?moduleId=${mod.id}`)) : [];
  const template = await ensure(
    `template '${TEMPLATE.slug}'`,
    async () => templateRows.find((t) => t.slug === TEMPLATE.slug),
    async () => {
      const created = await engine('POST', '/actions/templates', {
        ...TEMPLATE,
        moduleId: mod.id,
        steps: [action.id],
        isActive: true,
      });
      return { id: idOf(created) };
    },
  );
  const actionRuleRows = type?.id
    ? rows(await engine('GET', `/actions/transition-action-rules?workflowTypeId=${type.id}`))
    : [];
  await ensure(
    `action rule → approved runs template, success → credited`,
    async () =>
      actionRuleRows.find(
        (x) => x.toStatusId === sid('approved') && x.templateId === template?.id,
      ),
    async () =>
      engine('POST', '/actions/transition-action-rules', {
        workflowTypeId: type.id,
        templateId: template.id,
        fromStatusId: null,
        toStatusId: sid('approved'),
        onSuccessToStatusId: sid('credited'),
        trigger: 'on_transition',
        isActive: true,
      }),
  );

  // 6. Wallet .env --------------------------------------------------------------
  log('\nWallet .env');
  const keys = Object.keys(envUpdates);
  if (APPLY && keys.length) {
    const backup = upsertEnv(envUpdates);
    log(`  + set ${keys.join(', ')} (secrets not shown; backup ${path.basename(backup)})`);
  } else {
    log(`  would set ${['WORKFLOW_GRPC_TARGET', 'WORKFLOW_API_KEY', 'WORKFLOW_MODULE_ID', 'TOPUP_REQUEST_TYPE_ID'].join(', ')}`);
  }

  log(
    plan.length === 0
      ? '\nNothing to do — engine already configured.'
      : APPLY
      ? `\nDone: ${plan.length} change(s). Restart the wallet HTTP + gRPC processes to pick up .env.`
      : `\n${plan.length} change(s) pending. Re-run with --apply.`,
  );
}

async function issueWalletServiceKey() {
  if (process.env.WALLET_ENGINE_SERVICE_KEY) return process.env.WALLET_ENGINE_SERVICE_KEY;
  const issued = await wallet('POST', '/services', {
    name: `workflow-engine-${new Date().toISOString().slice(0, 10)}`,
    description: 'Workflow engine → wallet (SyncEntityStatus, DispatchAction)',
  });
  const key = issued?.apiKey;
  if (!key) throw new Error('Wallet did not return an apiKey for the engine service');
  log('  + issued wallet service key for the engine (not shown)');
  return key;
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
