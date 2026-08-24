import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rcrallyUsers = sqliteTable("rcrally_users", {
  username: text("username").primaryKey(),
  times: text("times", { mode: "json" }).$type<
    Record<string, { time: number; splits: number[] }>
  >(),
  parts: text("parts", { mode: "json" }).$type<Record<string, number>>(),
  objectives: text("objectives", { mode: "json" }).$type<
    Record<string, number>
  >(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});
