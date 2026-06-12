import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const appliancesTable = pgTable("appliances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  watts: real("watts").notNull(),
  hoursPerDay: real("hours_per_day").notNull(),
  daysPerMonth: integer("days_per_month").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApplianceSchema = createInsertSchema(appliancesTable).omit({ id: true, createdAt: true });
export type InsertAppliance = z.infer<typeof insertApplianceSchema>;
export type Appliance = typeof appliancesTable.$inferSelect;