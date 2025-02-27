import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateKey } from "../utils";

export const users = sqliteTable("users", {
  id: text().primaryKey().$defaultFn(createId),
  name: text().notNull(),
  username: text().notNull().unique(),
  apiKey: text().notNull().$defaultFn(generateKey),
  identities: text({ mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
});

export const usersRelations = relations(users, ({ many }) => ({
  usage: many(usage),
}));

export const usage = sqliteTable("usage", {
  id: text().primaryKey().$defaultFn(createId),
  userId: text().notNull(),
  date: int({ mode: "timestamp" }).notNull(),
  cost: int().notNull(),
  service: text().notNull(),
  endpoint: text().notNull(),
});

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, {
    fields: [usage.userId],
    references: [users.id],
  }),
}));
