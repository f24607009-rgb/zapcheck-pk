import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, billsTable, usersTable } from "@workspace/db";
import { eq, and, desc, avg, count, sum } from "drizzle-orm";
import { requireAuth, getAuthUserId } from "../lib/auth";
import { extractBillWithGroq, generateComplaintLetter } from "../lib/groq";
import { checkOvercharge, calculateBill } from "../lib/slabCalculator";
import { CheckOverchargeBody, SaveBillBody, GetBillParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: Router = Router();

// Uploads dir
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, and WebP images are supported."));
  },
});

// ── Manual overcharge check ──────────────────────────────────────────────

router.post("/bills/check", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckOverchargeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { units, billedAmount } = parsed.data;
  const result = await checkOvercharge(units, billedAmount);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({
    units: result.units,
    billedAmount: result.billedAmount,
    expectedAmount: result.expectedAmount,
    isOvercharged: result.isOvercharged,
    difference: result.difference,
    message: result.message,
    energyCharges: result.energyCharges,
    meterRent: result.meterRent,
    fca: result.fca,
    gst: result.gst,
    slabBreakdown: result.slabBreakdown,
  });
});

// ── Bill image upload + AI validation ────────────────────────────────────

router.post("/bills/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Please upload an image file." });
    return;
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const extracted = await extractBillWithGroq(imageBuffer, mimeType);

    if (!extracted.is_bill) {
      fs.unlinkSync(filePath);
      res.status(422).json({
        error: extracted.error ?? "This image is not a Pakistani electricity bill. Please upload a valid LESCO/MEPCO/WAPDA bill.",
      });
      return;
    }

    const units = Math.round(extracted.units_consumed ?? 0);
    const billed = extracted.total_amount ?? 0;

    let analysisResult = null;
    if (units > 0 && billed > 0) {
      const result = await checkOvercharge(units, billed);
      if (!("error" in result)) {
        analysisResult = {
          units: result.units,
          billedAmount: result.billedAmount,
          expectedAmount: result.expectedAmount,
          isOvercharged: result.isOvercharged,
          difference: result.difference,
          message: result.message,
          slabBreakdown: result.slabBreakdown,
          energyCharges: result.energyCharges,
          meterRent: result.meterRent,
          fca: result.fca,
          gst: result.gst,
        };
      }
    }

    fs.unlinkSync(filePath);
    res.json({
      extractedFields: extracted,
      analysis: analysisResult,
    });
  } catch (err) {
    req.log.error({ err }, "Error processing uploaded bill");
    try { fs.unlinkSync(filePath); } catch {}
    res.status(503).json({ error: "AI bill extraction failed. Please enter bill details manually." });
  }
});

// ── Save bill ─────────────────────────────────────────────────────────────

router.post("/bills", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveBillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  const data = parsed.data;

  const [bill] = await db
    .insert(billsTable)
    .values({
      userId,
      units: data.units,
      billedAmount: String(data.billedAmount),
      expectedAmount: String(data.expectedAmount),
      isOvercharged: data.isOvercharged,
      difference: String(data.difference),
      energyCharges: data.energyCharges != null ? String(data.energyCharges) : null,
      meterRent: data.meterRent != null ? String(data.meterRent) : null,
      fca: data.fca != null ? String(data.fca) : null,
      gst: data.gst != null ? String(data.gst) : null,
      slabBreakdown: data.slabBreakdown ?? null,
      billMonth: data.billMonth ?? null,
      meterReading: data.meterReading ?? null,
    })
    .returning();

  res.status(201).json({ id: bill.id, message: "Bill saved" });
});

// ── List bills ────────────────────────────────────────────────────────────

router.get("/bills", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const bills = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.userId, userId))
    .orderBy(desc(billsTable.createdAt))
    .limit(50);

  res.json({ bills: bills.map(formatBill) });
});

// ── Get latest meter reading for current user ─────────────────────────────

router.get("/bills/latest-reading", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);

  const [latestBill] = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.userId, userId))
    .orderBy(desc(billsTable.createdAt))
    .limit(1);

  if (!latestBill || latestBill.meterReading == null) {
    res.json({ meterReading: null });
    return;
  }

  res.json({ meterReading: latestBill.meterReading });
});

// ── Get single bill ───────────────────────────────────────────────────────

router.get("/bills/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBillParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(eq(billsTable.id, params.data.id), eq(billsTable.userId, userId)));

  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }
  res.json(formatBill(bill));
});

// ── Stats ─────────────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);

  const rows = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.userId, userId));

  const totalBills = rows.length;
  const overchargedCount = rows.filter((b) => b.isOvercharged).length;
  const totalOvercharge = rows.reduce((s, b) => s + (b.isOvercharged ? parseFloat(b.difference) : 0), 0);
  const avgUnits = totalBills > 0 ? rows.reduce((s, b) => s + b.units, 0) / totalBills : 0;

  res.json({
    totalBills,
    overchargedCount,
    totalOvercharge: Math.round(totalOvercharge * 100) / 100,
    avgUnits: Math.round(avgUnits * 10) / 10,
  });
});

// ── Complaint letter generation ──────────────────────────────────────────────

router.post("/bills/complaint", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as {
    discoName?: unknown;
    customerName?: unknown;
    consumerId?: unknown;
    referenceNo?: unknown;
    meterNo?: unknown;
    billingMonth?: unknown;
    units?: unknown;
    billedAmount?: unknown;
    expectedAmount?: unknown;
    difference?: unknown;
  };

  const discoName = typeof body.discoName === "string" && body.discoName.trim() ? body.discoName.trim() : "DISCO";
  const units = Number(body.units);
  const billedAmount = Number(body.billedAmount);
  const expectedAmount = Number(body.expectedAmount);
  const difference = Number(body.difference);

  if (isNaN(units) || isNaN(billedAmount) || isNaN(expectedAmount) || isNaN(difference)) {
    res.status(400).json({ error: "Invalid numeric fields." });
    return;
  }

  const letter = await generateComplaintLetter({
    discoName,
    customerName: typeof body.customerName === "string" ? body.customerName : null,
    consumerId: typeof body.consumerId === "string" ? body.consumerId : null,
    referenceNo: typeof body.referenceNo === "string" ? body.referenceNo : null,
    meterNo: typeof body.meterNo === "string" ? body.meterNo : null,
    billingMonth: typeof body.billingMonth === "string" ? body.billingMonth : null,
    units,
    billedAmount,
    expectedAmount,
    difference,
  });

  res.json({ letter });
});

function formatBill(bill: typeof billsTable.$inferSelect) {
  return {
    id: bill.id,
    units: bill.units,
    billedAmount: parseFloat(bill.billedAmount),
    expectedAmount: parseFloat(bill.expectedAmount),
    isOvercharged: bill.isOvercharged,
    difference: parseFloat(bill.difference),
    energyCharges: bill.energyCharges != null ? parseFloat(bill.energyCharges) : null,
    meterRent: bill.meterRent != null ? parseFloat(bill.meterRent) : null,
    fca: bill.fca != null ? parseFloat(bill.fca) : null,
    gst: bill.gst != null ? parseFloat(bill.gst) : null,
    slabBreakdown: (bill.slabBreakdown as unknown[]) ?? [],
    billMonth: bill.billMonth,
    meterReading: bill.meterReading ?? null,
    createdAt: bill.createdAt.toISOString(),
  };
}

export default router;
