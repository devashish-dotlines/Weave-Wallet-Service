import { UsageOperator } from './walletUsageRestriction';

/**
 * What a spend is for, keyed by usage-dimension CODE.
 *
 * A value is a SET, not a scalar: at 22:30 on a Sunday both NIGHT and WEEKEND
 * may apply, and forcing the caller to pick one would silently misfire the
 * rule. A bare string is accepted as a one-element set for convenience.
 *
 * The wallet compares already-resolved keys. It does NOT resolve the clock, a
 * dialled number, or anything else — that is the caller's job, and keeping it
 * so is what lets a dimension mean whatever the business needs.
 */
export type UsageContext = Record<string, string | string[]>;

/** A restriction flattened for evaluation: the dimension resolved to its code. */
export interface UsageRestrictionRule {
  dimensionCode: string;
  operator: UsageOperator;
  valueKeys: string[];
  groupNo: number;
}

export interface UsageEvaluation {
  allowed: boolean;
  /** The dimension that turned it down — for the rejection message. */
  failedDimensionCode?: string;
  reason?: string;
}

/** Normalise a context entry to an upper-cased set. Missing ⇒ null, not empty. */
function contextSet(
  context: UsageContext | undefined,
  dimensionCode: string,
): Set<string> | null {
  if (!context) return null;
  const raw = context[dimensionCode];
  if (raw === undefined || raw === null) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const keys = list.map((v) => String(v).trim()).filter(Boolean);
  return keys.length > 0 ? new Set(keys) : null;
}

function ruleMatches(
  rule: UsageRestrictionRule,
  context: UsageContext | undefined,
): boolean {
  const supplied = contextSet(context, rule.dimensionCode);
  // FAIL CLOSED. A restricted dimension the caller said nothing about is not
  // permission to spend — it's a caller that hasn't been taught the dimension
  // yet. This is why the enforcement mode defaults to 'off' and why 'shadow'
  // exists: flipping straight to 'enforce' would reject every such caller.
  if (supplied === null) return false;

  const tagged = new Set(rule.valueKeys);
  let intersects = false;
  for (const key of supplied) {
    if (tagged.has(key)) {
      intersects = true;
      break;
    }
  }
  // eq is `in` over a one-value set and neq is its negation, so both collapse
  // onto the same intersection test — the difference is only how many values
  // the rule is allowed to carry, which the use-case enforces on write.
  const positive = rule.operator === 'eq' || rule.operator === 'in';
  return positive ? intersects : !intersects;
}

/**
 * Does this wallet's restriction set permit a spend in this context?
 *
 * - No rules at all ⇒ allowed (the "empty ⇒ unrestricted" house convention).
 * - Within a group, every rule must pass (AND).
 * - Across groups, any group passing is enough (OR). Everything currently ships
 *   in group 0, so today this is a plain AND across dimensions.
 *
 * Pure by design — it takes the rules as an argument rather than living on the
 * Wallet aggregate, because the wallet repo's reads carry no includes and an
 * aggregate method would otherwise report "allowed" from props nobody loaded.
 */
export function evaluateUsage(
  rules: UsageRestrictionRule[],
  context: UsageContext | undefined,
): UsageEvaluation {
  if (!rules || rules.length === 0) return { allowed: true };

  const groups = new Map<number, UsageRestrictionRule[]>();
  for (const rule of rules) {
    const key = rule.groupNo ?? 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rule);
  }

  let firstFailure: UsageRestrictionRule | undefined;
  for (const group of groups.values()) {
    const failed = group.find((rule) => !ruleMatches(rule, context));
    if (!failed) return { allowed: true };
    if (!firstFailure) firstFailure = failed;
  }

  return {
    allowed: false,
    failedDimensionCode: firstFailure?.dimensionCode,
    reason: firstFailure
      ? `this balance is restricted by ${firstFailure.dimensionCode}`
      : 'this balance is restricted',
  };
}
