import { pgTable, serial, integer, numeric, boolean, json, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  units: integer("units").notNull(),
  billedAmount: numeric("billed_amount", { precision: 10, scale: 2 }).notNull(),
  expectedAmount: numeric("expected_amount", { precision: 10, scale: 2 }).notNull(),
  isOvercharged: boolean("is_overcharged").notNull().default(false),
  difference: numeric("difference", { precision: 10, scale: 2 }).notNull().default("0"),
  energyCharges: numeric("energy_charges", { precision: 10, scale: 2 }),
  meterRent: numeric("meter_rent", { precision: 10, scale: 2 }),
  fca: numeric("fca", { precision: 10, scale: 2 }),
  gst: numeric("gst", { precision: 10, scale: 2 }),
  slabBreakdown: json("slab_breakdown"),
  billMonth: text("bill_month"),
  meterReading: integer("meter_reading"), // current meter reading from bill
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBillSchema = createInsertSchema(billsTable).omit({ id: true, createdAt: true });
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;
