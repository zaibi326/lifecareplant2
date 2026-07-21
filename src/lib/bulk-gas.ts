// Shared helpers for bulk gas inventory: KG <-> Cubic Meter conversion and
// per-gas remaining bulk gas computation (purchased − consumed).

export const DEFAULT_OXYGEN_FACTOR = 0.7383;

// Unit → cubic meter conversion constants.
export const CFT_TO_M3 = 0.0283168; // 1 cubic foot = 0.0283168 m³
export const LITRE_TO_M3 = 0.001; // 1 litre = 0.001 m³

/**
 * Convert any supported capacity/quantity unit to cubic meters so that all
 * bulk-gas maths happens in one canonical unit (m³).
 * - m3    → as-is
 * - cft   → × 0.0283168
 * - litre → × 0.001
 * - kg    → × oxygen factor (needs a gas-specific factor; defaults to oxygen)
 */
export function toM3(
  value: number | null | undefined,
  unit: string | null | undefined,
  kgFactor = DEFAULT_OXYGEN_FACTOR,
): number {
  const v = Number(value) || 0;
  switch ((unit ?? "m3").toLowerCase()) {
    case "cft":
      return v * CFT_TO_M3;
    case "litre":
    case "liter":
    case "l":
      return v * LITRE_TO_M3;
    case "kg":
      return v * (Number(kgFactor) || DEFAULT_OXYGEN_FACTOR);
    case "m3":
    default:
      return v;
  }
}

/** Normalise a purchase quantity to cubic meters. */
export function toCubicMeter(quantity: number, unit: string, factor: number): number {
  const q = Number(quantity) || 0;
  if (unit === "kg") return q * (Number(factor) || DEFAULT_OXYGEN_FACTOR);
  return q;
}

/**
 * Gas consumed by a filling run, expressed in cubic meters.
 * = cylinder capacity × quantity filled, converted from the capacity unit to m³.
 * Passing no unit keeps the legacy behaviour (capacity treated as m³).
 */
export function gasConsumed(
  capacity: number | null | undefined,
  quantityFilled: number,
  capacityUnit: string | null | undefined = "m3",
  kgFactor = DEFAULT_OXYGEN_FACTOR,
): number {
  const native = (Number(capacity) || 0) * (Number(quantityFilled) || 0);
  return toM3(native, capacityUnit, kgFactor);
}

export type PurchaseRow = { gas_type_id: string | null; cubic_meter: number | null };
export type ProductionConsumptionRow = { gas_type_id: string | null; gas_consumed: number | null };

/**
 * Build a per-gas bulk balance map.
 * remaining = totalPurchased − totalConsumed (clamped at 0 for display).
 */
export function buildBulkBalances(
  purchases: PurchaseRow[],
  production: ProductionConsumptionRow[],
): Map<string, { purchased: number; consumed: number; remaining: number }> {
  const map = new Map<string, { purchased: number; consumed: number; remaining: number }>();
  const ensure = (id: string) => {
    let v = map.get(id);
    if (!v) {
      v = { purchased: 0, consumed: 0, remaining: 0 };
      map.set(id, v);
    }
    return v;
  };
  for (const p of purchases) {
    if (!p.gas_type_id) continue;
    ensure(p.gas_type_id).purchased += Number(p.cubic_meter ?? 0);
  }
  for (const p of production) {
    if (!p.gas_type_id) continue;
    ensure(p.gas_type_id).consumed += Number(p.gas_consumed ?? 0);
  }
  for (const v of map.values()) v.remaining = v.purchased - v.consumed;
  return map;
}

export const formatM3 = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} m³`;
