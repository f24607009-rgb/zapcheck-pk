import { db, tariffsTable, fixedChargesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type SlabBreakdown = { label: string; units: number; rate: number; charge: number };

type BillCalculation = {
  units: number;
  energyCharges: number;
  meterRent: number;
  fca: number;
  subtotal: number;
  gst: number;
  totalBill: number;
  slabBreakdown: SlabBreakdown[];
};

type OverchargeResult = BillCalculation & {
  billedAmount: number;
  expectedAmount: number;
  difference: number;
  isOvercharged: boolean;
  message: string;
};

let tariffCache: Array<{ label: string; min: number; max: number; rate: number }> | null = null;
let chargesCache: Record<string, number> | null = null;

export function invalidateCache(): void {
  tariffCache = null;
  chargesCache = null;
}

async function loadTariffs(): Promise<{
  tariffs: Array<{ label: string; min: number; max: number; rate: number }>;
  charges: Record<string, number>;
}> {
  if (tariffCache && chargesCache) {
    return { tariffs: tariffCache, charges: chargesCache };
  }

  const slabs = await db
    .select()
    .from(tariffsTable)
    .where(eq(tariffsTable.isActive, true))
    .orderBy(tariffsTable.minUnits);

  const charges = await db
    .select()
    .from(fixedChargesTable)
    .where(eq(fixedChargesTable.isActive, true));

  tariffCache = slabs.map((s) => ({
    label: s.slabLabel,
    min: s.minUnits,
    max: s.maxUnits,
    rate: parseFloat(s.ratePerUnit),
  }));

  chargesCache = {};
  for (const c of charges) {
    chargesCache[c.chargeName] = parseFloat(c.chargeValue);
  }

  return { tariffs: tariffCache, charges: chargesCache };
}

export async function calculateBill(units: number): Promise<BillCalculation | { error: string }> {
  if (units <= 0) return { error: "Units must be greater than 0" };

  const { tariffs, charges } = await loadTariffs();

  if (!tariffs.length) return { error: "Tariff data not available. Please contact support." };

  const meterRent = charges["meter_rent"] ?? 35;
  const gstPct = charges["gst_percent"] ?? 17;
  const fcaPerUnit = charges["fca_per_unit"] ?? 1.87;

  let energy = 0;
  const breakdown: SlabBreakdown[] = [];
  let remaining = units;

  for (const slab of tariffs) {
    if (remaining <= 0) break;
    const cap = slab.max - slab.min + 1;
    const n = Math.min(remaining, cap);
    const charge = n * slab.rate;
    energy += charge;
    breakdown.push({ label: slab.label, units: n, rate: slab.rate, charge: Math.round(charge * 100) / 100 });
    remaining -= n;
  }

  const fca = Math.round(units * fcaPerUnit * 100) / 100;
  const subtotal = energy + meterRent + fca;
  const gst = Math.round(subtotal * gstPct / 100 * 100) / 100;
  const totalBill = Math.round((subtotal + gst) * 100) / 100;

  return {
    units,
    energyCharges: Math.round(energy * 100) / 100,
    meterRent,
    fca,
    subtotal: Math.round(subtotal * 100) / 100,
    gst,
    totalBill,
    slabBreakdown: breakdown,
  };
}

export async function checkOvercharge(units: number, billedAmount: number): Promise<OverchargeResult | { error: string }> {
  const calc = await calculateBill(units);
  if ("error" in calc) return calc;

  const expected = calc.totalBill;
  const diff = Math.round((billedAmount - expected) * 100) / 100;

  return {
    ...calc,
    billedAmount,
    expectedAmount: expected,
    difference: diff,
    isOvercharged: diff > 50,
    message: diff > 50 ? `Overcharge of Rs. ${diff}` : "Bill amount looks correct",
  };
}
