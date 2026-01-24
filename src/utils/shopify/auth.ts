import { AuthScopes, Session } from '@shopify/shopify-api'
import { eq } from 'drizzle-orm'
import type {
  SelectSession,
  SelectShop} from '~/db/schema';
import { db } from '~/db'
import {
  sessionsTable,
  shopsTable,
} from '~/db/schema'
import { SHOP_QUERY } from '~/graphql/queries'
import logger from '~/utils/logger'
import { apiVersion, shopifyApp } from '~/utils/shopify/app'

export function createAdminApiGraphqlClient(session: Session | SelectSession) {
  const shopifySession =
    session instanceof Session
      ? session
      : new Session({
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope ?? undefined,
          expires: session.expires ?? undefined,
          accessToken: session.accessToken ?? undefined,
          refreshToken: session.refreshToken ?? undefined,
          refreshTokenExpires: session.refreshTokenExpires ?? undefined,
          onlineAccessInfo: session.onlineAccessInfo ?? undefined,
        })

  return new shopifyApp.clients.Graphql({
    session: shopifySession,
    apiVersion,
  })
}

export async function getValidSessionWithShop(
  sessionId: string
): Promise<{ session: SelectSession; shop: SelectShop } | null> {
  const [result] = await db
    .select({
      session: sessionsTable,
      shop: shopsTable,
    })
    .from(sessionsTable)
    .innerJoin(shopsTable, eq(sessionsTable.shop, shopsTable.domain))
    .where(eq(sessionsTable.id, sessionId))

  if (!result) {
    return null
  }

  if (!isSessionValid(result.session)) {
    return null
  }

  return result
}

function isSessionValid(session: SelectSession): boolean {
  const requiredScopes = shopifyApp.config.scopes
  const sessionScopes = new AuthScopes(session.scope ?? undefined)

  if (!sessionScopes.has(requiredScopes)) {
    logger.warn('[auth] Session missing required scopes, re-authenticating', {
      type: 'auth',
      shopDomain: session.shop,
      sessionScopes: sessionScopes.toArray(),
      requiredScopes: requiredScopes?.toArray() ?? [],
    })

    return false
  }

  if (session.isOnline && session.expires) {
    const isExpired = new Date(session.expires) <= new Date()

    if (isExpired) {
      logger.warn('[auth] Online session expired, re-authenticating', {
        type: 'auth',
        shopDomain: session.shop,
      })

      return false
    }
  }

  if (!session.accessToken) {
    logger.warn('[auth] Session missing access token, re-authenticating', {
      type: 'auth',
      shopDomain: session.shop,
    })

    return false
  }

  return true
}

export async function upsertSessionAndShop(session: Session): Promise<{
  session: SelectSession
  shop: SelectShop
}> {
  const [upsertedSession] = await db
    .insert(sessionsTable)
    .values({
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope,
      expires: session.expires,
      accessToken: session.accessToken,
    })
    .onConflictDoUpdate({
      target: sessionsTable.id,
      set: {
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires,
        accessToken: session.accessToken,
      },
    })
    .returning()

  const shopData =
    await createAdminApiGraphqlClient(session).request(SHOP_QUERY)

  if (shopData.errors || !shopData.data?.shop) {
    logger.error('[auth] Failed to fetch shop data from Shopify', {
      type: 'auth',
      errors: shopData.errors,
    })

    throw new Error('Failed to fetch shop data from Shopify')
  }

  const [upsertedShop] = await db
    .insert(shopsTable)
    .values({
      domain: shopData.data.shop.myshopifyDomain,
      name: shopData.data.shop.name,
      email: shopData.data.shop.email,
      timezone: shopData.data.shop.ianaTimezone,
      currency: shopData.data.shop.currencyCode,
      plan: shopData.data.shop.plan?.publicDisplayName,
    })
    .onConflictDoUpdate({
      target: shopsTable.domain,
      set: {
        name: shopData.data.shop.name,
        email: shopData.data.shop.email,
        timezone: shopData.data.shop.ianaTimezone,
        currency: shopData.data.shop.currencyCode,
        plan: shopData.data.shop.plan?.publicDisplayName,
      },
    })
    .returning()

  return {
    session: upsertedSession,
    shop: upsertedShop,
  }
}
