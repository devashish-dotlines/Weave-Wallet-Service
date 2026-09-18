import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../../config/index';

// Resolve the proto from the project root (cwd under `npm start`/nodemon).
// Kept byte-identical to the accounting service's proto/ledger.proto.
const PROTO_PATH = path.resolve(process.cwd(), 'proto/ledger.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto: any = grpc.loadPackageDefinition(packageDefinition);
const LedgerServiceClient = proto.accounting.v1.LedgerService;

export type VoucherType = 'JOURNAL' | 'SALES_INVOICE' | 'PAYMENT_RECEIPT' | 'PAYMENT';

export interface PostFromEventInput {
  eventType: string;
  payload: Record<string, unknown>;
  voucherType: VoucherType;
  /** Unix seconds; omitted = now (accounting side). */
  voucherDate?: number;
  narration: string;
  /** Idempotency key: a retry returns the voucher already posted for it. */
  sourceEvent: string;
  requestedBy: string;
}

export interface VoucherResult {
  voucherId: string;
  voucherNumber: string;
  warnings: string[];
}

/**
 * Client onto the accounting `LedgerService`. Every call is idempotent on
 * `source_event`, so callers may retry freely. Errors are thrown (not
 * swallowed): the caller decides whether a failed posting is retried later.
 * Authenticated with this service's API key (`x-api-key`).
 */
export class LedgerClient {
  private readonly client: any;

  constructor(
    target: string,
    private readonly apiKey: string,
    private readonly deadlineMs: number,
  ) {
    this.client = new LedgerServiceClient(
      target,
      grpc.credentials.createInsecure(),
    );
  }

  private metadata(): grpc.Metadata {
    const md = new grpc.Metadata();
    md.set('x-api-key', this.apiKey);
    return md;
  }

  postFromEvent(input: PostFromEventInput): Promise<VoucherResult> {
    return new Promise((resolve, reject) => {
      this.client.PostFromEvent(
        {
          event_type: input.eventType,
          payload_json: JSON.stringify(input.payload ?? {}),
          voucher_type: input.voucherType,
          voucher_date: input.voucherDate ?? 0,
          narration: input.narration,
          source_event: input.sourceEvent,
          requested_by: input.requestedBy,
          role_ids: [],
        },
        this.metadata(),
        { deadline: Date.now() + this.deadlineMs },
        (err: grpc.ServiceError | null, res: any) => {
          if (err) return reject(err);
          resolve(toVoucherResult(res));
        },
      );
    });
  }

  reverseBySourceEvent(
    sourceEvent: string,
    narration: string,
    requestedBy: string,
  ): Promise<VoucherResult> {
    return new Promise((resolve, reject) => {
      this.client.ReverseVoucher(
        {
          voucher_id: '',
          source_event: sourceEvent,
          narration,
          requested_by: requestedBy,
        },
        this.metadata(),
        { deadline: Date.now() + this.deadlineMs },
        (err: grpc.ServiceError | null, res: any) => {
          if (err) return reject(err);
          resolve(toVoucherResult(res));
        },
      );
    });
  }

  /**
   * Active currencies and their rate to the accounting base currency. A
   * voucher is always posted in base, so a caller holding another currency
   * converts with these first.
   */
  /**
   * Active accounts the organisation collects payments into (bank / MFS),
   * maintained under Accounting → Collection Accounts.
   */
  listCollectionAccounts(currencyCode = ''): Promise<CollectionAccountInfo[]> {
    return new Promise((resolve, reject) => {
      this.client.ListCollectionAccounts(
        { currency_code: currencyCode },
        this.metadata(),
        { deadline: Date.now() + this.deadlineMs },
        (err: grpc.ServiceError | null, res: any) => {
          if (err) return reject(err);
          resolve((res?.accounts ?? []).map(toCollectionAccount));
        },
      );
    });
  }

  listCurrencies(): Promise<CurrencyList> {
    return new Promise((resolve, reject) => {
      this.client.ListCurrencies(
        {},
        this.metadata(),
        { deadline: Date.now() + this.deadlineMs },
        (err: grpc.ServiceError | null, res: any) => {
          if (err) return reject(err);
          resolve({
            baseCode: String(res?.base_code ?? '').toUpperCase(),
            currencies: (res?.currencies ?? []).map((c: any) => ({
              id: String(c.id ?? ''),
              code: String(c.code ?? '').toUpperCase(),
              symbol: String(c.symbol ?? ''),
              name: String(c.name ?? ''),
              isBase: !!c.is_base,
              conversionRate: Number(c.conversion_rate ?? 0),
            })),
          });
        },
      );
    });
  }
}

function toChannel(v: unknown): CollectionChannel {
  const s = String(v ?? '');
  return s === 'MFS' || s === 'BILL_PAYMENT' ? s : 'BANK';
}

function toCollectionAccount(a: any): CollectionAccountInfo {
  return {
    code: String(a?.code ?? ''),
    channel: toChannel(a?.channel),
    currencyCode: String(a?.currency_code ?? '').toUpperCase(),
    institutionName: String(a?.institution_name ?? ''),
    accountName: String(a?.account_name ?? ''),
    accountNo: String(a?.account_no ?? ''),
    payerReference: a?.payer_reference || undefined,
    branch: a?.branch || undefined,
    routingNo: a?.routing_no || undefined,
    mfsAccountType: a?.mfs_account_type || undefined,
    acceptedMethods: Array.isArray(a?.accepted_methods)
      ? a.accepted_methods.map((m: any) => String(m))
      : [],
    instructions: a?.instructions || undefined,
    glAccountCode: a?.gl_account_code || undefined,
  };
}

function toVoucherResult(res: any): VoucherResult {
  return {
    voucherId: String(res?.voucher_id ?? ''),
    voucherNumber: String(res?.voucher_number ?? ''),
    warnings: Array.isArray(res?.warnings)
      ? res.warnings.map((w: any) => String(w))
      : [],
  };

}

/** Configured singleton, or null when ACCOUNTING_GRPC_TARGET is unset. */
export interface CurrencyInfo {
  /** acc_currency.id — the unit id a CURRENCY-category wallet stores. */
  id: string;
  code: string;
  symbol: string;
  name: string;
  isBase: boolean;
  /** Base amount ONE unit of this currency is worth (base MYR: USD = 4.0975). */
  conversionRate: number;
}

export type CollectionChannel = 'BANK' | 'MFS' | 'BILL_PAYMENT';

/** An org account payers send money to (accounting `acc_collection_account`). */
export interface CollectionAccountInfo {
  /** Stable reference stored on a top-up request (`bankAccountCode`). */
  code: string;
  channel: CollectionChannel;
  currencyCode: string;
  /** Bank name, MFS provider (bKash, ...) or bill-payment scheme (JomPAY). */
  institutionName: string;
  accountName: string;
  /** Account / wallet number; the biller code for BILL_PAYMENT. */
  accountNo: string;
  /** Fixed reference to quote (JomPAY Ref-1); absent = payer's own. */
  payerReference?: string;
  branch?: string;
  routingNo?: string;
  mfsAccountType?: string;
  /** CASH | BANK_TRANSFER | CHEQUE | MFS | BILL_PAYMENT */
  acceptedMethods: string[];
  instructions?: string;
  glAccountCode?: string;
}

export interface CurrencyList {
  baseCode: string;
  currencies: CurrencyInfo[];
}

export const ledgerClient: LedgerClient | null = config.accounting.grpcTarget
  ? new LedgerClient(
      config.accounting.grpcTarget,
      config.accounting.apiKey,
      config.accounting.deadlineMs,
    )
  : null;
