import { pgTable, serial, text, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tariffsTable = pgTable("tariffs", {
  id: serial("id").primaryKey(),
  slabLabel: text("slab_label").notNull(),
  minUnits: integer("min_units").notNull(),
  maxUnits: integer("max_units").notNull(),
  ratePerUnit: numeric("rate_per_unit", { precision: 8, scale: 4 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull().default("2025-01-01"),
});

export const fixedChargesTable = pgTable("fixed_charges", {
  id: serial("id").primaryKey(),
  chargeName: text("charge_name").notNull().unique(),
  chargeValue: numeric("charge_value", { precision: 10, scale: 4 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertTariffSchema = createInsertSchema(tariffsTable).omit({ id: true });
export type InsertTariff = z.infer<typeof insertTariffSchema>;
export type Tariff = typeof tariffsTable.$inferSelect;

export const insertFixedChargeSchema = createInsertSchema(fixedChargesTable).omit({ id: true });
export type InsertFixedCharge = z.infer<typeof insertFixedChargeSchema>;
export type FixedCharge = typeof fixedChargesTable.$inferSelect;
