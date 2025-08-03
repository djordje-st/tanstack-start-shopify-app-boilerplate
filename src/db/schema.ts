import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core'

export const sessions = pgTable(
  'session',
  {
    id: text().primaryKey(),
    shop: text().notNull().unique(),
    state: text().notNull(),
    isOnline: boolean().default(false).notNull(),
    scope: text(),
    expires: timestamp({ mode: 'date' }),
    accessToken: text(),
  },
  table => [
    index('session_id_idx').on(table.id),
    index('session_shop_idx').on(table.shop),
  ]
)

export const shops = pgTable(
  'shop',
  {
    id: uuid().primaryKey().defaultRandom(),
    domain: text().notNull().unique(),
    name: text(),
    email: text(),
    contactEmail: text(),
    currencyCode: text(),
    weightUnit: text(),
    timezone: text(),
    url: text(),

    createdAt: timestamp({ mode: 'string' }).defaultNow(),
    updatedAt: timestamp({ mode: 'string' }).defaultNow(),
  },
  table => [
    index('shop_id_idx').on(table.id),
    index('shop_domain_idx').on(table.domain),
  ]
)

export type SelectSession = typeof sessions.$inferSelect
export type SelectShop = typeof shops.$inferSelect
