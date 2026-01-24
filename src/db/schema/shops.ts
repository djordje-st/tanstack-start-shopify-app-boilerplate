import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from './common'

export const shopsTable = pgTable(
  'shop',
  {
    id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
    domain: text().notNull().unique(),
    name: text(),
    email: text(),
    timezone: text(),
    currency: text(),
    plan: text(),

    ...timestamps,
  },
  table => [index('shop_domain_idx').on(table.domain)]
)

export type SelectShop = typeof shopsTable.$inferSelect
