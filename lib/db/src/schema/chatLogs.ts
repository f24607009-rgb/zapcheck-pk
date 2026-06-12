import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { billsTable } from "./bills";

export const chatLogsTable = pgTable("chat_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  billId: integer("bill_id").references(() => billsTable.id, { onDelete: "set null" }),
  userMessage: text("user_message").notNull(),
  botResponse: text("bot_response").notNull(),
  status: text("status").notNull().default("answered"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChatLogSchema = createInsertSchema(chatLogsTable).omit({ id: true, createdAt: true });
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;
export type ChatLog = typeof chatLogsTable.$inferSelect;
