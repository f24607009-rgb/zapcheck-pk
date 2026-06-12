import Groq from "groq-sdk";
import sharp from "sharp";
import { logger } from "./logger";

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY environment variable is not set.");
    _client = new Groq({ apiKey: key });
  }
  return _client;
}

const ESCALATION_KEYWORDS = ["complaint", "fraud", "legal", "court", "stolen", "corrupt", "dispute"];

export function needsEscalation(message: string): boolean {
  const low = message.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => low.includes(kw));
}

// ── Image preprocessing ─────────────────────────────────────────────────────

async function preprocessImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  let img = sharp(buffer);
  const meta = await img.metadata();

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longest = Math.max(w, h);

  if (longest > 0 && longest < 1200) {
    const scale = 1200 / longest;
    img = img.resize(Math.round(w * scale), Math.round(h * scale), { fit: "inside" });
  }
  if (longest > 2400) {
    img = img.resize(2400, 2400, { fit: "inside" });
  }

  const processed = await img
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.5 })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { buffer: processed, mimeType: "image/png" };
}

// ── Bill vision prompt ───────────────────────────────────────────────────────

const VISION_PROMPT = `You are an expert OCR system for Pakistani NEPRA electricity bills.

STEP 1 — Determine if this image is a Pakistani electricity bill from a DISCO:
LESCO, MEPCO, FESCO, GEPCO, HESCO, PESCO, QESCO, IESCO, SEPCO, or WAPDA.
If NOT a bill (selfie, photo, other document) → return: {"is_bill":false,"confidence":0,"error":"Not an electricity bill"}

STEP 2 — If it IS a bill, extract every visible field using the EXACT label mapping below.

=== CRITICAL FIELD MAPPING — PAKISTAN ELECTRICITY BILLS ===

ENERGY/DISCO CHARGES:
  "energy_charges" ← look for: "[DISCO Name] Charges Total", "Distribution Charges", "Energy Charges"

GOVERNMENT CHARGES:
  "taxes" ← look for: "Government Charges Total", "GST", "Income Tax", "TV License"

FUEL ADJUSTMENT:
  "fca_charges" ← look for: "Fuel Price Adjustment", "FPA", "FCA", "Fuel Cost Adjustment"

TV FEE:
  "tv_fee" ← look for: "TV Fee", "PTV Fee", "TV License Fee"

CURRENT BILL:
  "current_bill" ← look for: "Current Bill", "Net Current Bill", "Current Month Bill"

FINAL PAYABLE AMOUNT (MOST IMPORTANT):
  "total_amount" ← MUST come from "Payable Within Due Date" ONLY

LATE PAYMENT AMOUNT:
  "payable_after_due_date" ← look for: "Payable After Due Date", "After Due Date"

METER READINGS:
  "previous_reading" ← look for: "Previous Reading", "Old Reading", "Last Reading"
  "current_reading" ← look for: "Present Reading", "Current Reading", "New Reading"
  "units_consumed" ← look for: "Units Consumed", "KWH", "Net Units"

CONSUMER INFO:
  "customer_name" ← "Consumer Name", "Name of Consumer"
  "reference_number" ← "Reference No.", "Ref No", "Account No."
  "consumer_id" ← "Consumer No.", "Consumer ID", "Meter Account"
  "meter_number" ← "Meter No.", "Meter Number", "Serial No."
  "electricity_provider" ← the DISCO name from bill header

DATES:
  "billing_month" ← "Month of Issue", "Billing Month" (format: Month YYYY)
  "issue_date" ← "Issue Date", "Billing Date" (DD/MM/YYYY)
  "due_date" ← "Due Date", "Last Date for Payment" (DD/MM/YYYY)

=== RESPOND WITH ONLY THIS JSON — NO EXPLANATION, NO MARKDOWN ===

{
  "is_bill": true,
  "confidence": <0-100>,
  "electricity_provider": "<DISCO name or null>",
  "customer_name": "<string or null>",
  "reference_number": "<string or null>",
  "consumer_id": "<string or null>",
  "meter_number": "<string or null>",
  "billing_month": "<Month YYYY or null>",
  "issue_date": "<DD/MM/YYYY or null>",
  "due_date": "<DD/MM/YYYY or null>",
  "previous_reading": <integer or null>,
  "current_reading": <integer or null>,
  "units_consumed": <integer or null>,
  "energy_charges": <number or null>,
  "fca_charges": <number or null>,
  "tv_fee": <number or null>,
  "taxes": <number or null>,
  "current_bill": <number or null>,
  "total_amount": <number from "Payable Within Due Date" ONLY or null>,
  "payable_after_due_date": <number or null>,
  "raw_text": "<key labels and values you can read, comma-separated>"
}

confidence: 90-100=crystal clear, 70-89=mostly readable, 50-69=partial, <50=difficult
All monetary values: plain numbers without commas or Rs. symbol
Use null for any field not clearly visible — never guess`;

export type ExtractionResult = {
  is_bill: boolean;
  confidence: number;
  error?: string;
  electricity_provider?: string | null;
  customer_name?: string | null;
  reference_number?: string | null;
  consumer_id?: string | null;
  meter_number?: string | null;
  billing_month?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  previous_reading?: number | null;
  current_reading?: number | null;
  units_consumed?: number | null;
  energy_charges?: number | null;
  fca_charges?: number | null;
  tv_fee?: number | null;
  taxes?: number | null;
  current_bill?: number | null;
  total_amount?: number | null;
  payable_after_due_date?: number | null;
  raw_text?: string | null;
  validation_warnings?: string[];
  warning?: string;
};

function validateExtraction(result: ExtractionResult): string[] {
  const warnings: string[] = [];

  if (result.units_consumed == null) {
    warnings.push("Units consumed could not be extracted — please enter manually below");
  } else if (result.units_consumed < 0 || result.units_consumed > 10000) {
    warnings.push(`Units consumed (${result.units_consumed}) seems unusual — please verify`);
  }

  if (result.total_amount == null) {
    warnings.push('Payable amount could not be found — please enter the "Payable Within Due Date" value manually');
  } else if (result.total_amount < 0 || result.total_amount > 500000) {
    warnings.push(`Total amount (Rs. ${result.total_amount}) seems unusual — please verify`);
  }

  if (result.previous_reading != null && result.current_reading != null) {
    const calc = result.current_reading - result.previous_reading;
    if (result.units_consumed != null && Math.abs(calc - result.units_consumed) > 5) {
      warnings.push(
        `Units mismatch: readings (${result.previous_reading}→${result.current_reading}) suggest ${calc} units, but bill shows ${result.units_consumed} units`
      );
    }
  }

  if (result.confidence < 60) {
    warnings.push("Image quality is low — please verify all extracted values or upload a clearer photo");
  }

  return warnings;
}

export async function extractBillWithGroq(
  imageBuffer: Buffer,
  originalMimeType: string
): Promise<ExtractionResult> {
  const client = getClient();

  let processedBuffer: Buffer;
  let processedMime: string;
  try {
    const prepped = await preprocessImage(imageBuffer);
    processedBuffer = prepped.buffer;
    processedMime = prepped.mimeType;
  } catch (prepErr) {
    logger.warn({ err: prepErr }, "Image preprocessing failed, using original");
    processedBuffer = imageBuffer;
    processedMime = originalMimeType;
  }

  const b64 = processedBuffer.toString("base64");

  const resp = await client.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${processedMime};base64,${b64}` } },
          { type: "text", text: VISION_PROMPT },
        ],
      },
    ],
    max_tokens: 900,
    temperature: 0,
  });

  const text = resp.choices[0]?.message?.content?.trim() ?? "";
  const match = text.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as ExtractionResult;

      if (!parsed.is_bill) {
        return {
          is_bill: false,
          confidence: 0,
          error: parsed.error ?? "This image does not appear to be a Pakistani electricity bill.",
        };
      }

      if (
        parsed.units_consumed == null &&
        parsed.previous_reading != null &&
        parsed.current_reading != null
      ) {
        parsed.units_consumed = parsed.current_reading - parsed.previous_reading;
      }

      if (parsed.total_amount == null && parsed.current_bill != null) {
        parsed.total_amount = parsed.current_bill;
      }

      parsed.validation_warnings = validateExtraction(parsed);
      return parsed;
    } catch {
      // JSON parse failed
    }
  }

  const lower = text.toLowerCase();
  if (lower.includes("not") && (lower.includes("bill") || lower.includes("electricity"))) {
    return { is_bill: false, confidence: 0, error: "This image does not appear to be an electricity bill." };
  }

  return {
    is_bill: true,
    confidence: 30,
    units_consumed: null,
    total_amount: null,
    validation_warnings: ["Could not parse AI response — please enter bill details manually."],
  };
}

// ── Complaint letter ─────────────────────────────────────────────────────────

export type ComplaintLetterInput = {
  discoName: string;
  customerName?: string | null;
  consumerId?: string | null;
  referenceNo?: string | null;
  meterNo?: string | null;
  billingMonth?: string | null;
  units: number;
  billedAmount: number;
  expectedAmount: number;
  difference: number;
};

export async function generateComplaintLetter(input: ComplaintLetterInput): Promise<string> {
  const client = getClient();

  const today = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });

  const prompt = `Generate a formal electricity overcharge complaint letter for a Pakistani consumer.

Consumer Details:
- DISCO (electricity company): ${input.discoName}
- Consumer Name: ${input.customerName ?? "[Consumer Name]"}
- Consumer No.: ${input.consumerId ?? "[Consumer No.]"}
- Reference No.: ${input.referenceNo ?? "[Reference No.]"}
- Meter No.: ${input.meterNo ?? "[Meter No.]"}
- Billing Month: ${input.billingMonth ?? "[Billing Month]"}
- Units Consumed: ${input.units} kWh
- Amount Charged by DISCO: Rs. ${input.billedAmount.toLocaleString()}
- Correct Amount (NEPRA tariff): Rs. ${input.expectedAmount.toLocaleString()}
- Overcharge Amount: Rs. ${input.difference.toLocaleString()}
- Today's Date: ${today}

Write a professional, formal complaint letter in English addressed to the Manager (Customer Services) of ${input.discoName}.

The letter must:
1. Start with "To," followed by the recipient address block
2. Include a clear Subject line mentioning the billing month and overcharge
3. Reference NEPRA (National Electric Power Regulatory Authority) tariff rates as the basis for the correct amount
4. List all consumer details in a structured block
5. Politely but firmly demand correction in the next bill or a refund
6. Mention that the consumer may escalate to NEPRA if not resolved
7. End with a formal closing and the consumer's name
8. Be concise — no more than 350 words

Output ONLY the letter text. No preamble, no explanation.`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 700,
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from AI");
  return text.trim();
}

// ── Chatbot ─────────────────────────────────────────────────────────────────

type BillContext = {
  units?: number;
  billedAmount?: number;
  expectedAmount?: number;
  isOvercharged?: boolean;
  difference?: number;
  energyCharges?: number | null;
  meterRent?: number | null;
  fca?: number | null;
  gst?: number | null;
  slabBreakdown?: Array<{ label: string; units: number; rate: number; charge: number }>;
};

type RecentBill = {
  units: number;
  billedAmount: number | string;
  isOvercharged: boolean;
  billMonth?: string | null;
};

export async function askChatbot(
  userMessage: string,
  billContext?: BillContext | null,
  recentBills?: RecentBill[]
): Promise<string> {
  let system =
    "You are a helpful electricity bill assistant for Pakistani households. " +
    "You help users understand their LESCO, WAPDA, MEPCO electricity bills. " +
    "Explain charges like FCA, GST, and NEPRA slabs in simple terms. " +
    "If the user writes in English, reply in English. If Urdu, reply in Urdu. " +
    "Be specific and concise. Use actual numbers from the provided bill data when available.";

  if (billContext) {
    const { units, billedAmount, expectedAmount, isOvercharged, difference, energyCharges, fca, gst, meterRent, slabBreakdown } = billContext;
    const overchargeStr = isOvercharged ? `YES — Rs. ${difference} extra charged` : "NO — bill is correct";
    system +=
      "\n\nCURRENT ANALYZED BILL DATA:\n" +
      `- Units Consumed: ${units ?? "N/A"} kWh\n` +
      `- Billed Amount (Payable Within Due Date): Rs. ${billedAmount ?? "N/A"}\n` +
      `- Expected (NEPRA calculation): Rs. ${expectedAmount ?? "N/A"}\n` +
      `- Overcharged: ${overchargeStr}\n` +
      `- Energy Charges: Rs. ${energyCharges ?? "N/A"}\n` +
      `- Meter Rent: Rs. ${meterRent ?? "N/A"}\n` +
      `- Fuel Charge Adjustment (FCA): Rs. ${fca ?? "N/A"}\n` +
      `- GST (17%): Rs. ${gst ?? "N/A"}\n`;
    if (slabBreakdown?.length) {
      system += "- Slab Breakdown:\n";
      for (const s of slabBreakdown) {
        system += `  ${s.label}: ${s.units} units × Rs.${s.rate} = Rs.${s.charge}\n`;
      }
    }
  }

  if (recentBills && recentBills.length > 1) {
    system += "\nUSER'S RECENT BILL HISTORY:\n";
    recentBills.slice(0, 4).forEach((b, i) => {
      const month = b.billMonth ?? `Bill ${i + 1}`;
      const status = b.isOvercharged ? "OVERCHARGED" : "Correct";
      system += `- ${month}: ${b.units} kWh, Rs. ${b.billedAmount} (${status})\n`;
    });
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
    max_tokens: 450,
  });

  const answer = response.choices[0]?.message?.content;
  if (!answer) throw new Error("No response from AI");
  return answer;
}

// ── Meter image reading extraction ──────────────────────────────────────────

export type MeterExtractionResult = {
  success: boolean;
  confidence: number;
  current_reading: number | null;
  error?: string;
};

const METER_PROMPT = `You are an expert OCR system for electricity meter reading.

Look at this image carefully. It should be a photo of an electricity meter showing a numeric reading.

Extract the meter reading (the number shown on the meter display or dials).

Rules:
- Only read the BLACK digits, ignore any RED digits at the end
- Read left to right
- Ignore decimal points

Respond ONLY with this JSON, no explanation:
{
  "success": true or false,
  "confidence": <0-100>,
  "current_reading": <integer number or null>,
  "error": "<only if success is false>"
}`;

export async function extractMeterReading(
  imageBuffer: Buffer,
  originalMimeType: string
): Promise<MeterExtractionResult> {
  const client = getClient();

  let processedBuffer: Buffer;
  let processedMime: string;
  try {
    const prepped = await preprocessImage(imageBuffer);
    processedBuffer = prepped.buffer;
    processedMime = prepped.mimeType;
  } catch {
    processedBuffer = imageBuffer;
    processedMime = originalMimeType;
  }

  const b64 = processedBuffer.toString("base64");

  const resp = await client.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${processedMime};base64,${b64}` } },
          { type: "text", text: METER_PROMPT },
        ],
      },
    ],
    max_tokens: 100,
    temperature: 0,
  });

  const text = resp.choices[0]?.message?.content?.trim() ?? "";
  const match = text.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as MeterExtractionResult;
      return parsed;
    } catch {
      // JSON parse failed
    }
  }

  return {
    success: false,
    confidence: 0,
    current_reading: null,
    error: "Could not read meter — please enter reading manually.",
  };
}