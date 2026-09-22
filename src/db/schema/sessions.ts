import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { OnlineAccessInfo } from '@shopify/shopify-api'

export const sessionsTable = pgTable('session', {
  id: text().primaryKey(),
  shop: text().notNull().unique(),
  state: text().notNull(),
  isOnline: boolean('is_online').default(false).notNull(),
  scope: text(),
  expires: timestamp({ mode: 'date' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  refreshTokenExpires: timestamp('refresh_token_expires', { mode: 'date' }),
  onlineAccessInfo: jsonb('online_access_info').$type<OnlineAccessInfo>(),
})

export type SelectSession = typeof sessionsTable.$inferSelect
