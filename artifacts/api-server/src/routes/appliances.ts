import { Router } from "express";
import { db, appliancesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getAuthUserId } from "../lib/auth";
import { calculateBill } from "../lib/slabCalculator";

const router: Router = Router();

// ── Add appliance ──────────────────────────────────────

router.post("/appliances", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const { name, type, watts, hoursPerDay, daysPerMonth } = req.body as {
    name?: unknown;
    type?: unknown;
    watts?: unknown;
    hoursPerDay?: unknown;
    daysPerMonth?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Appliance name is required." });
    return;
  }
  if (typeof type !== "string" || !type.trim()) {
    res.status(400).json({ error: "Appliance type is required." });
    return;
  }
  const wattsNum = Number(watts);
  const hoursNum = Number(hoursPerDay);
  if (isNaN(wattsNum) || wattsNum <= 0) {
    res.status(400).json({ error: "Watts must be a positive number." });
    return;
  }
  if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 24) {
    res.status(400).json({ error: "Hours per day must be between 0 and 24." });
    return;
  }
  const daysNum = Number(daysPerMonth);
  if (isNaN(daysNum) || daysNum < 1 || daysNum > 31) {
    res.status(400).json({ error: "Days per month must be between 1 and 31." });
    return;
  }

  const [appliance] = await db
    .insert(appliancesTable)
    .values({
      userId,
      name: name.trim(),
      type: type.trim(),
      watts: wattsNum,
      hoursPerDay: hoursNum,
      daysPerMonth: daysNum,
    })
    .returning();

  res.status(201).json(formatAppliance(appliance));
});

// ── List appliances ──────────────────────────────────────

router.get("/appliances", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const appliances = await db
    .select()
    .from(appliancesTable)
    .where(eq(appliancesTable.userId, userId));

  res.json({ appliances: appliances.map(formatAppliance) });
});

// ── Predict monthly bill ──────────────────────────────────────

router.get("/appliances/predict", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);

  const appliances = await db
    .select()
    .from(appliancesTable)
    .where(eq(appliancesTable.userId, userId));

  if (appliances.length === 0) {
    res.status(404).json({ error: "No appliances found. Please add appliances first." });
    return;
  }

  const monthlyKwh = appliances.reduce((sum, a) => sum + (a.watts * a.hoursPerDay * a.daysPerMonth) / 1000, 0);
  const dailyKwh = monthlyKwh / 30;
  const monthlyUnits = Math.round(monthlyKwh);

  const result = await calculateBill(monthlyUnits);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    dailyKwh: Math.round(dailyKwh * 100) / 100,
    monthlyUnits,
    predictedBill: result.totalBill,
    breakdown: {
      energyCharges: result.energyCharges,
      meterRent: result.meterRent,
      fca: result.fca,
      gst: result.gst,
    },
    slabBreakdown: result.slabBreakdown,
    applianceCount: appliances.length,
  });
});

// ── Delete appliance ──────────────────────────────────────

router.delete("/appliances/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const id = Number(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appliance ID." });
    return;
  }

  await db
    .delete(appliancesTable)
    .where(and(eq(appliancesTable.id, id), eq(appliancesTable.userId, userId)));

  res.json({ message: "Appliance deleted" });
});

function formatAppliance(appliance: typeof appliancesTable.$inferSelect) {
  return {
    id: appliance.id,
    name: appliance.name,
    type: appliance.type,
    watts: appliance.watts,
    hoursPerDay: appliance.hoursPerDay,
    daysPerMonth: appliance.daysPerMonth,
    createdAt: appliance.createdAt.toISOString(),
  };
}

export default router;