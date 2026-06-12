import { Router } from "express";
import { db, tariffsTable, fixedChargesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { invalidateCache } from "../lib/slabCalculator";
import { UpdateTariffRateBody, UpdateTariffRateParams, UpdateFixedChargeBody, UpdateFixedChargeParams } from "@workspace/api-zod";

const router: Router = Router();

// ── Public tariff data ────────────────────────────────────────────────────

router.get("/tariffs", async (_req, res): Promise<void> => {
  const slabs = await db
    .select()
    .from(tariffsTable)
    .where(eq(tariffsTable.isActive, true))
    .orderBy(tariffsTable.minUnits);

  const charges = await db
    .select()
    .from(fixedChargesTable)
    .where(eq(fixedChargesTable.isActive, true));

  res.json({
    slabs: slabs.map((s) => ({
      label: s.slabLabel,
      min: s.minUnits,
      max: s.maxUnits,
      rate: parseFloat(s.ratePerUnit),
    })),
    charges: Object.fromEntries(charges.map((c) => [c.chargeName, parseFloat(c.chargeValue)])),
  });
});

// ── Admin: full tariff data ───────────────────────────────────────────────

router.get("/tariffs/admin", requireAuth, async (_req, res): Promise<void> => {
  const slabs = await db.select().from(tariffsTable).orderBy(tariffsTable.minUnits);
  const charges = await db.select().from(fixedChargesTable);

  res.json({
    slabs: slabs.map((s) => ({
      id: s.id,
      slabLabel: s.slabLabel,
      minUnits: s.minUnits,
      maxUnits: s.maxUnits,
      ratePerUnit: parseFloat(s.ratePerUnit),
      isActive: s.isActive,
    })),
    charges: charges.map((c) => ({
      id: c.id,
      chargeName: c.chargeName,
      chargeValue: parseFloat(c.chargeValue),
      description: c.description,
      isActive: c.isActive,
    })),
  });
});

// ── Admin: update tariff rate ─────────────────────────────────────────────

router.patch("/tariffs/:id/rate", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTariffRateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateTariffRateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.rate <= 0) {
    res.status(400).json({ error: "Rate must be positive" });
    return;
  }

  await db
    .update(tariffsTable)
    .set({ ratePerUnit: String(body.data.rate) })
    .where(eq(tariffsTable.id, params.data.id));

  invalidateCache();
  res.json({ message: "Tariff updated" });
});

// ── Admin: update fixed charge ────────────────────────────────────────────

router.patch("/tariffs/charges/:name", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateFixedChargeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateFixedChargeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.value <= 0) {
    res.status(400).json({ error: "Value must be positive" });
    return;
  }

  await db
    .update(fixedChargesTable)
    .set({ chargeValue: String(body.data.value) })
    .where(eq(fixedChargesTable.chargeName, params.data.name));

  invalidateCache();
  res.json({ message: "Charge updated" });
});

export default router;
