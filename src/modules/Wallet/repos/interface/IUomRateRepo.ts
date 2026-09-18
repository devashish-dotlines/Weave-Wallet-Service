import { UomRate } from '../../domain/uomRate';

export interface IUomRateRepo {
  /**
   * The rate whose window contains `atSeconds`. Windows never overlap, so at
   * most one row can match.
   */
  findEffective(uomId: string, atSeconds: number): Promise<UomRate | null>;
  /** Live rates whose window intersects [from, to]; `to` null = open-ended. */
  findOverlapping(
    uomId: string,
    fromSeconds: number,
    toSeconds: number | null,
    excludeId?: string,
  ): Promise<UomRate[]>;
  /** Every live rate for a UOM, newest first; all UOMs when omitted. */
  list(uomId?: string): Promise<UomRate[]>;
  create(domainObject: UomRate): Promise<string | null>;
  /** Persist a changed end date (the only edit a rate allows). */
  updateEffectiveTo(domainObject: UomRate): Promise<string | null>;
}
