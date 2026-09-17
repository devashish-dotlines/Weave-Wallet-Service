import { sendUnaryData } from '@grpc/grpc-js';
import { AuthedCall } from '../../../../infra/grpc/authInterceptor';
import { toGrpcError } from '../../../../infra/grpc/grpcStatusMap';
import { provisionWalletUseCase } from '../../useCases/wallet';

/**
 * Server side of `WalletProvisioningService` — the only write path into this
 * service that does NOT come through the gateway. subscription-billing calls it
 * to create a customer's bundle allowance wallets when a subscription is
 * created; it holds a service API key, not a Keycloak token, so it cannot use
 * the HTTP routes.
 *
 * Reads snake_case fields (proto-loader keepCase) and is guarded by the shared
 * API-key interceptor at registration. Errors map through the same table the
 * REST controllers use, so a caller sees the same distinctions: NOT_FOUND for a
 * bad wallet type / dimension, FAILED_PRECONDITION for a rejected UOM.
 */
export async function provisionWallet(
  call: AuthedCall<any>,
  callback: sendUnaryData<any>,
): Promise<void> {
  try {
    const r = call.request ?? {};
    const restrictions = Array.isArray(r.restrictions) ? r.restrictions : [];

    const result = await provisionWalletUseCase.execute({
      externalRef: String(r.external_ref ?? ''),
      walletTypeId: String(r.wallet_type_id ?? ''),
      uomId: String(r.uom_id ?? ''),
      ownerTypeCode: String(r.owner_type_code ?? ''),
      ownerId: String(r.owner_id ?? ''),
      displayName: r.display_name ? String(r.display_name) : undefined,
      // proto3 has no null: 0 is the wire encoding of "never expires".
      expiresAt: Number(r.expires_at ?? 0) || undefined,
      initialCredit: Number(r.initial_credit ?? 0) || 0,
      creditIdempotencyKey: r.credit_idempotency_key
        ? String(r.credit_idempotency_key)
        : undefined,
      restrictions: restrictions.map((x: any) => ({
        dimensionKey: String(x.dimension_key ?? ''),
        operator: String(x.operator ?? ''),
        valueKeys: Array.isArray(x.value_keys) ? x.value_keys.map(String) : [],
      })),
      requestedBy: String(r.requested_by ?? ''),
    });

    if (result.isLeft()) {
      const { code, message } = toGrpcError(result.value);
      return callback({ code, message });
    }
    const out = result.value.getValue();
    return callback(null, {
      wallet_id: out.walletId,
      created: out.created,
      credited: out.credited,
    });
  } catch (err) {
    const { code, message } = toGrpcError(err);
    return callback({ code, message });
  }
}
