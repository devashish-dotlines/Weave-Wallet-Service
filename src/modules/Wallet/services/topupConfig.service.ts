import { z } from 'zod';
import { ConfigClient } from '../../../infra/grpc/clients/configClient';

/**
 * Typed reader over the configuration-service `WALLET_TOPUP` type. One key,
 * `json`:
 *
 *   limits        = { "BDT": { bankDeposit: {min,max} },      // by currency
 *                     "POINTS": { transfer: {min,max,dailyMax} } }  // by UOM
 *                   A deposit limit is a currency amount; a transfer never
 *                   leaves the wallet's unit, so its limits are keyed by UOM.
 * The accounts payers deposit into are NOT here: they are owned by accounting
 * (Accounting → Collection Accounts), see CollectionAccountDirectory.
 * Conversion rates are NOT here either: a wallet unit's value lives in `wlt_uom_rate`
 * (effective-dated, in base currency) and a currency's rate to base comes from
 * accounting. See ConversionService.
 *
 * A value scoped to `wallet` wins over a global (unscoped) one. Missing or
 * malformed config is reported as unavailable — money movement never falls
 * back to a silent default.
 */
export const TOPUP_CONFIG_TYPE = 'WALLET_TOPUP';
const SERVICE_SCOPE = 'wallet';

const amount = z.number().nonnegative();
const range = z
  .object({ min: amount, max: amount })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' });

const depositRangeSchema = range;
const transferRangeSchema = z
  .object({ min: amount, max: amount, dailyMax: amount })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' });
const codeLimitsSchema = z.object({
  bankDeposit: depositRangeSchema.optional(),
  transfer: transferRangeSchema.optional(),
});
const limitsSchema = z.record(codeLimitsSchema);

export type TopupDepositLimits = z.infer<typeof depositRangeSchema>;
export type TopupTransferLimits = z.infer<typeof transferRangeSchema>;

/** Config is absent, unreadable, or does not cover the requested UOM. */
export class TopupConfigUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopupConfigUnavailableError';
  }
}

export interface ITopupConfigService {
  /** Deposit limits for a currency; throws when unset. */
  depositLimits(currencyCode: string): Promise<TopupDepositLimits>;
  /** Transfer limits for a wallet UOM; throws when unset. */
  transferLimits(uomCode: string): Promise<TopupTransferLimits>;
}

export class TopupConfigService implements ITopupConfigService {
  constructor(private readonly client: ConfigClient | null) {}

  async depositLimits(currencyCode: string): Promise<TopupDepositLimits> {
    const all = await this.read('limits', limitsSchema);
    const limits = all[currencyCode.toUpperCase()]?.bankDeposit;
    if (!limits) {
      throw new TopupConfigUnavailableError(
        `No deposit limits configured for ${currencyCode}`,
      );
    }
    return limits;
  }

  async transferLimits(uomCode: string): Promise<TopupTransferLimits> {
    const all = await this.read('limits', limitsSchema);
    const limits = all[uomCode.toUpperCase()]?.transfer;
    if (!limits) {
      throw new TopupConfigUnavailableError(
        `No transfer limits configured for ${uomCode}`,
      );
    }
    return limits;
  }

  /** Like `read`, but an unconfigured key yields undefined instead of throwing. */
  private async readOptional<S extends z.ZodTypeAny>(
    key: string,
    schema: S,
  ): Promise<z.output<S> | undefined> {
    try {
      return await this.read(key, schema);
    } catch (err) {
      if (
        err instanceof TopupConfigUnavailableError &&
        err.message.endsWith('is not configured')
      ) {
        return undefined;
      }
      throw err;
    }
  }

  private async read<S extends z.ZodTypeAny>(
    key: string,
    schema: S,
  ): Promise<z.output<S>> {
    if (!this.client) {
      throw new TopupConfigUnavailableError(
        'Configuration service is not configured (CONFIG_GRPC_TARGET)',
      );
    }
    let values;
    try {
      values = await this.client.lookup(TOPUP_CONFIG_TYPE, key);
    } catch (err) {
      throw new TopupConfigUnavailableError(
        `Configuration service unavailable: ${(err as Error).message}`,
      );
    }
    const chosen =
      values?.find((v) => v.key === key && v.scope === SERVICE_SCOPE) ??
      values?.find((v) => v.key === key && v.scope === '');
    if (!chosen) {
      throw new TopupConfigUnavailableError(
        `${TOPUP_CONFIG_TYPE}.${key} is not configured`,
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(chosen.value);
    } catch {
      throw new TopupConfigUnavailableError(
        `${TOPUP_CONFIG_TYPE}.${key} is not valid JSON`,
      );
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[topup-config] ${TOPUP_CONFIG_TYPE}.${key} is malformed:`,
        parsed.error.format(),
      );
      throw new TopupConfigUnavailableError(
        `${TOPUP_CONFIG_TYPE}.${key} is malformed`,
      );
    }
    return parsed.data;
  }
}
