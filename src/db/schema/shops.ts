import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from './common'

export const shopsTable = pgTable('shop', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  domain: text().notNull().unique(),
  name: text(),
  email: text(),
  timezone: text(),
  currency: text(),
  plan: text(),

  ...timestamps,
})

export type SelectShop = typeof shopsTable.$inferSelect
export type InsertShop = typeof shopsTable.$inferInsert
