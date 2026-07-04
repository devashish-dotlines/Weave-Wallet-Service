import { AuditableEntity } from '../../../core/domain/AuditableEntity';
import { UniqueEntityID } from '../../../core/domain/UniqueEntityID';
import { BaseEntityProps } from '../../../core/domain/Interfaces/BaseEntityProps';
import { Result } from '../../../core/logic/Result';
import { Guard } from '../../../core/logic/Guard';

export type WalletTxType = 'credit' | 'debit' | 'transfer' | 'adjustment';
export const WALLET_TX_TYPES: WalletTxType[] = [
  'credit',
  'debit',
  'transfer',
  'adjustment',
];

/** The sign of the balance change this row applies to its `walletId`. */
export type WalletTxDirection = 'credit' | 'debit';
export const WALLET_TX_DIRECTIONS: WalletTxDirection[] = ['credit', 'debit'];

export type WalletTxState =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'cancelled';
export const WALLET_TX_STATES: WalletTxState[] = [
  'pending',
  'completed',
  'failed',
  'reversed',
  'cancelled',
];

export interface WalletTransactionProps extends BaseEntityProps {
  /** Auto-generated unique code, prefix `WTX`. */
  code: string;
  /** The wallet whose cached balance this row moves. */
  walletId: string;
  txType: WalletTxType;
  direction: WalletTxDirection;
  /** For a transfer leg, the other wallet involved. */
  counterpartyWalletId?: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  state: WalletTxState;
  /** At-most-once key for the logical operation (FR-TX-8). */
  idempotencyKey?: string;
  /** Links the two legs of a transfer (credit leg → debit leg). */
  parentTransactionId?: string;
  description?: string;
}

/**
 * An immutable record of one balance movement on one wallet. Until the
 * double-entry ledger lands, these rows are the source of truth from which a
 * wallet's cached balance is (re)computed. A transfer is two linked rows: a
 * debit leg on the source and a credit leg on the destination.
 */
export class WalletTransaction extends AuditableEntity<WalletTransactionProps> {
  get id(): UniqueEntityID {
    return this._id;
  }
  get code(): string {
    return this.props.code;
  }
  get walletId(): string {
    return this.props.walletId;
  }
  get txType(): WalletTxType {
    return this.props.txType;
  }
  get direction(): WalletTxDirection {
    return this.props.direction;
  }
  get counterpartyWalletId(): string | undefined {
    return this.props.counterpartyWalletId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get balanceBefore(): number {
    return this.props.balanceBefore;
  }
  get balanceAfter(): number {
    return this.props.balanceAfter;
  }
  get state(): WalletTxState {
    return this.props.state;
  }
  get idempotencyKey(): string | undefined {
    return this.props.idempotencyKey;
  }
  get parentTransactionId(): string | undefined {
    return this.props.parentTransactionId;
  }
  get description(): string | undefined {
    return this.props.description;
  }

  private constructor(props: WalletTransactionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  public static create(
    props: WalletTransactionProps,
    id?: UniqueEntityID,
  ): Result<WalletTransaction> {
    const guard = Guard.againstNullOrUndefinedOrEmptyBulk([
      { argument: props.code, argumentName: 'code' },
      { argument: props.walletId, argumentName: 'walletId' },
      { argument: props.createdBy, argumentName: 'createdBy' },
      { argument: props.updatedBy, argumentName: 'updatedBy' },
    ]);
    if (!guard.succeeded) return Result.fail<WalletTransaction>(guard.message);

    const nn = Guard.againstNullOrUndefinedBulk([
      { argument: props.amount, argumentName: 'amount' },
      { argument: props.balanceBefore, argumentName: 'balanceBefore' },
      { argument: props.balanceAfter, argumentName: 'balanceAfter' },
      { argument: props.createdAt, argumentName: 'createdAt' },
      { argument: props.updatedAt, argumentName: 'updatedAt' },
    ]);
    if (!nn.succeeded) return Result.fail<WalletTransaction>(nn.message);

    const typeOk = Guard.isOneOf(props.txType, WALLET_TX_TYPES, 'txType');
    if (!typeOk.succeeded) return Result.fail<WalletTransaction>(typeOk.message);

    const dirOk = Guard.isOneOf(
      props.direction,
      WALLET_TX_DIRECTIONS,
      'direction',
    );
    if (!dirOk.succeeded) return Result.fail<WalletTransaction>(dirOk.message);

    const stateOk = Guard.isOneOf(props.state, WALLET_TX_STATES, 'state');
    if (!stateOk.succeeded) return Result.fail<WalletTransaction>(stateOk.message);

    if (!(props.amount > 0)) {
      return Result.fail<WalletTransaction>('amount must be greater than 0');
    }

    return Result.ok<WalletTransaction>(
      new WalletTransaction({ ...props }, id),
    );
  }
}
