/**
 * The unit a balance is held in: a category plus a unit id within it. For a
 * CURRENCY category the id is accounting's acc_currency.id; for a LOCAL
 * category it is a wlt_uom id. Resolve it with the UnitRegistry — never branch
 * on the category in a use case.
 */
export interface UnitRef {
  categoryId: string;
  unitId: string;
}

export function sameUnit(a: UnitRef, b: UnitRef): boolean {
  return a.categoryId === b.categoryId && a.unitId === b.unitId;
}
