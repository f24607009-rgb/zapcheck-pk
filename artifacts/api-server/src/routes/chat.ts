import { Router } from "express";
import { db, chatLogsTable, billsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getAuthUserId } from "../lib/auth";
import { needsEscalation, askChatbot } from "../lib/groq";
import { SendChatBody } from "@workspace/api-zod";

const router: Router = Router();

router.post("/chat", requireAuth, async (req, res): Promise<void> => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, billContext, billId } = parsed.data;
  const userId = getAuthUserId(req);

  if (needsEscalation(message)) {
    const resp = "Your query has been escalated to our support team. They will contact you shortly.";
    await db.insert(chatLogsTable).values({
      userId,
      billId: billId ?? null,
      userMessage: message,
      botResponse: resp,
      status: "escalated",
    });
    res.json({ status: "escalated", response: resp });
    return;
  }

  // Load recent bills for context
  const recentBills = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.userId, userId))
    .orderBy(desc(billsTable.createdAt))
    .limit(4);

  const recentFormatted = recentBills.map((b) => ({
    units: b.units,
    billedAmount: parseFloat(b.billedAmount),
    isOvercharged: b.isOvercharged,
    billMonth: b.billMonth,
  }));

  try {
    const answer = await askChatbot(
      message,
      billContext as Record<string, unknown> | undefined,
      recentFormatted
    );

    await db.insert(chatLogsTable).values({
      userId,
      billId: billId ?? null,
      userMessage: message,
      botResponse: answer,
      status: "answered",
    });

    res.json({ status: "answered", response: answer });
  } catch (err) {
    res.status(503).json({ error: "AI chatbot is temporarily unavailable. Please try again later." });
  }
});

router.get("/chat/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuthUserId(req);
  const logs = await db
    .select()
    .from(chatLogsTable)
    .where(eq(chatLogsTable.userId, userId))
    .orderBy(desc(chatLogsTable.createdAt))
    .limit(100);

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      userMessage: l.userMessage,
      botResponse: l.botResponse,
      status: l.status,
      billId: l.billId,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

export default router;
