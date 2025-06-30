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
    id: text('id').primaryKey(),
    shop: text('shop').notNull().unique(),
    state: text('state').notNull(),
    isOnline: boolean('isOnline').default(false).notNull(),
    scope: text('scope'),
    expires: timestamp('expires', { mode: 'date' }),
    accessToken: text('accessToken'),
  },
  table => [
    index('session_id_idx').on(table.id),
    index('session_shop_idx').on(table.shop),
  ]
)

export const shops = pgTable(
  'shop',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domain: text('domain').notNull().unique(),

    name: text('name'),
    email: text('email'),
    contactEmail: text('contactEmail'),
    currencyCode: text('currencyCode'),
    weightUnit: text('weightUnit'),
    timezone: text('timezone'),
    url: text('url'),

    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow(),
  },
  table => [
    index('shop_id_idx').on(table.id),
    index('shop_domain_idx').on(table.domain),
  ]
)

export type SelectSession = typeof sessions.$inferSelect
export type SelectShop = typeof shops.$inferSelect
