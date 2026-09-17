import { UseCase } from '../../../../core/domain/UseCase';
import { Result, left, right } from '../../../../core/logic/Result';
import { BaseErrors } from '../../../../core/infra/BaseErrors';
import { GenericAppError } from '../../../../core/logic/AppError';
import {
  ProvisionWalletDTO,
  ProvisionWalletResultDTO,
} from '../../DTO/walletDTO';
import { IWalletRepo } from '../../repos/interface/IWalletRepo';
import { IOwnerTypeRepo } from '../../repos/interface/IOwnerTypeRepo';
import { IUsageDimensionRepo } from '../../repos/interface/IUsageDimensionRepo';
import { UsageOperator } from '../../domain/walletUsageRestriction';
import { SetWalletUsageRestrictionRowDTO } from '../../DTO/walletUsageRestrictionDTO';
import { WalletResponse } from '../shared/response';
import { CreateWalletUseCase } from './wallet.use-cases';
import { SetWalletUsageRestrictionsUseCase } from '../walletUsageRestriction/walletUsageRestriction.use-cases';
import { CreditWalletUseCase } from '../walletTransaction/walletTransaction.use-cases';

/**
 * Create a wallet on another service's behalf, restrict it, and fund it — as one
 * idempotent operation.
 *
 * This is the service-to-service entry point behind `WalletProvisioningService`.
 * It exists because the HTTP wallet routes all sit behind a gateway-forwarded
 * Keycloak token, which a backend caller does not have; and because a caller
 * that had to make three separate calls could not recover from a failure between
 * them.
 *
 * IDEMPOTENCY. `externalRef` is unique on `wlt_wallet`, so a replay finds the
 * original wallet instead of minting a second one. Crucially the replay does NOT
 * stop there — it continues on to re-apply the restrictions and re-attempt the
 * credit. That is what repairs a call that died partway through:
 *
 *   - restrictions are a whole-set REPLACE, so re-applying is a no-op;
 *   - the credit carries `creditIdempotencyKey`, and the unique index on
 *     `wlt_wallet_transaction.idempotency_key` makes a second attempt return the
 *     original transaction rather than double-funding the customer.
 *
 * Those two properties are why this needs no wrapping transaction and no
 * compensating undo: every step is safe to repeat, so forward retry always
 * converges on a fully-provisioned wallet. Returning early on an existing
 * `externalRef` would break exactly that, leaving an unfunded wallet no retry
 * could ever repair.
 */
export class ProvisionWalletUseCase
  implements UseCase<ProvisionWalletDTO, Promise<WalletResponse<ProvisionWalletResultDTO>>>
{
  constructor(
    private readonly walletRepo: IWalletRepo,
    private readonly ownerTypeRepo: IOwnerTypeRepo,
    private readonly dimensionRepo: IUsageDimensionRepo,
    private readonly createWallet: CreateWalletUseCase,
    private readonly setRestrictions: SetWalletUsageRestrictionsUseCase,
    private readonly creditWallet: CreditWalletUseCase,
  ) {}

  async execute(
    dto: ProvisionWalletDTO,
  ): Promise<WalletResponse<ProvisionWalletResultDTO>> {
    try {
      const externalRef = (dto.externalRef ?? '').trim();
      if (!externalRef) {
        return left(
          new BaseErrors.ValidationError('externalRef is required'),
        );
      }

      const existing = await this.walletRepo.findByExternalRef(externalRef);
      let walletId: string;
      let created = false;

      if (existing) {
        walletId = existing.id.toString();
      } else {
        // The owner type is named by CODE, not id: these are seeded rows whose
        // ids differ per environment, so a caller holding an id would break on
        // every fresh database.
        const ownerType = await this.ownerTypeRepo.findByCode(
          (dto.ownerTypeCode ?? '').trim().toUpperCase(),
        );
        if (!ownerType) {
          return left(
            new BaseErrors.NotFoundError(
              `Owner type "${dto.ownerTypeCode}" not found`,
            ),
          );
        }

        // Delegate rather than insert directly, so this path keeps every check
        // the panel's create path has — in particular that the UOM is allowed
        // by the wallet type's balance type. A bundle type can easily be tagged
        // with a wallet UOM its wallet type does not permit, and that must
        // surface as a clean business-rule error, not a constraint violation.
        const createdOrError = await this.createWallet.execute({
          walletTypeId: dto.walletTypeId,
          uomId: dto.uomId,
          ownerTypeId: ownerType.id.toString(),
          ownerId: dto.ownerId,
          externalRef,
          displayName: dto.displayName,
          expiresAt: dto.expiresAt,
          requestedBy: dto.requestedBy,
        });
        if (createdOrError.isLeft()) return left(createdOrError.value);
        walletId = createdOrError.value.getValue();
        created = true;
      }

      // Whole-set replace — safe to re-run, and it converges a wallet whose
      // restrictions never landed on the first attempt.
      if (dto.restrictions.length > 0) {
        const rows: SetWalletUsageRestrictionRowDTO[] = [];
        for (const r of dto.restrictions) {
          const dimension = await this.dimensionRepo.findByKey(
            (r.dimensionKey ?? '').trim(),
          );
          if (!dimension) {
            return left(
              new BaseErrors.NotFoundError(
                `Usage dimension "${r.dimensionKey}" not found`,
              ),
            );
          }
          rows.push({
            usageDimensionId: dimension.id.toString(),
            operator: r.operator as UsageOperator,
            valueKeys: r.valueKeys,
          });
        }
        const restricted = await this.setRestrictions.execute({
          walletId,
          restrictions: rows,
          requestedBy: dto.requestedBy,
        });
        if (restricted.isLeft()) return left(restricted.value);
      }

      let credited = false;
      if (dto.initialCredit > 0) {
        if (!dto.creditIdempotencyKey) {
          return left(
            new BaseErrors.ValidationError(
              'creditIdempotencyKey is required when initialCredit is set',
            ),
          );
        }
        const before = await this.walletRepo.findById(walletId);
        const creditOrError = await this.creditWallet.execute({
          walletId,
          amount: dto.initialCredit,
          description: dto.displayName
            ? `Provisioned allowance — ${dto.displayName}`
            : 'Provisioned allowance',
          idempotencyKey: dto.creditIdempotencyKey,
          requestedBy: dto.requestedBy,
        });
        if (creditOrError.isLeft()) return left(creditOrError.value);
        // The credit use case returns the ORIGINAL transaction id on a replay,
        // so the id alone can't distinguish "funded now" from "already funded".
        // The balance moving is the only honest signal.
        const after = await this.walletRepo.findById(walletId);
        credited = (after?.balance ?? 0) !== (before?.balance ?? 0);
      }

      return right(
        Result.ok<ProvisionWalletResultDTO>({ walletId, created, credited }),
      );
    } catch (err) {
      return left(new GenericAppError.UnexpectedError(err));
    }
  }
}
