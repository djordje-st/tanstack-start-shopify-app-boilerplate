import '@tanstack/react-start/server-only'
import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { eq } from 'drizzle-orm'
import type { SelectSession, SelectShop } from '#/db/schema'
import { db } from '#/db'
import { sessionsTable, shopsTable } from '#/db/schema'
import { addLogContext, serializeError } from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

type SessionWithShop = {
  session: Session
  shop: SelectShop
}

const sessionUpdates = new Map<string, Promise<SessionWithShop | null>>()

function toShopifySession(session: SelectSession): Session {
  return new Session({
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
}

export function createAdminApiGraphqlClient(session: Session) {
  return new shopifyApp.clients.Graphql({ session })
}

async function loadSessionWithShop(
  shopDomain: string
): Promise<SessionWithShop | null> {
  const [result] = await db
    .select({ session: sessionsTable, shop: shopsTable })
    .from(sessionsTable)
    .innerJoin(shopsTable, eq(sessionsTable.shop, shopsTable.domain))
    .where(eq(sessionsTable.shop, shopDomain))

  return result
    ? { session: toShopifySession(result.session), shop: result.shop }
    : null
}

function isActiveOfflineSession(session: Session): boolean {
  return (
    !session.isOnline &&
    session.isActive(shopifyApp.config.scopes, EXPIRY_BUFFER_MS)
  )
}

async function saveSession(session: Session): Promise<SessionWithShop> {
  const values = {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshTokenExpires: session.refreshTokenExpires,
  }

  await Promise.all([
    db
      .insert(shopsTable)
      .values({ domain: session.shop })
      .onConflictDoNothing(),
    db
      .insert(sessionsTable)
      .values(values)
      .onConflictDoUpdate({ target: sessionsTable.shop, set: values }),
  ])

  return (await loadSessionWithShop(session.shop))!
}

export async function getOfflineSessionWithShop(
  shopDomain: string,
  sessionToken?: string
): Promise<SessionWithShop | null> {
  const current = await loadSessionWithShop(shopDomain)

  if (current && isActiveOfflineSession(current.session)) {
    return current
  }

  const pending = sessionUpdates.get(shopDomain)

  if (pending) {
    const result = await pending

    return (
      result ??
      (sessionToken
        ? getOfflineSessionWithShop(shopDomain, sessionToken)
        : null)
    )
  }

  const update = (async () => {
    const latest = await loadSessionWithShop(shopDomain)

    if (latest && isActiveOfflineSession(latest.session)) {
      return latest
    }

    const session = latest?.session
    const canRefresh =
      session &&
      !session.isOnline &&
      session.isScopeIncluded(shopifyApp.config.scopes ?? []) &&
      session.refreshToken &&
      session.refreshTokenExpires &&
      session.refreshTokenExpires.getTime() - EXPIRY_BUFFER_MS > Date.now()

    if (canRefresh) {
      try {
        const refreshed = await shopifyApp.auth.refreshToken({
          shop: shopDomain,
          refreshToken: session.refreshToken!,
        })

        return saveSession(refreshed.session)
      } catch (error) {
        addLogContext({
          auth_token_refresh: 'failed',
          auth_error: serializeError(error),
          shop_domain: shopDomain,
        })
      }
    }

    if (!sessionToken) {
      return null
    }

    const exchanged = await shopifyApp.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
      expiring: true,
    })

    return saveSession(exchanged.session)
  })().finally(() => sessionUpdates.delete(shopDomain))

  sessionUpdates.set(shopDomain, update)

  return update
}
