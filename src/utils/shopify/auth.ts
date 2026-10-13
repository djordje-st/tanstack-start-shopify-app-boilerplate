import '@tanstack/react-start/server-only'
import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { eq } from 'drizzle-orm'
import type { InsertShop, SelectSession, SelectShop } from '#/db/schema'
import { db } from '#/db'
import { sessionsTable, shopsTable } from '#/db/schema'
import { SHOP_DETAILS_QUERY } from '#/graphql/admin/queries'
import { addLogContext, serializeError } from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

type SessionWithShop = {
  session: Session
  shop: SelectShop
}

type ShopDetails = Pick<
  InsertShop,
  'name' | 'email' | 'timezone' | 'currency' | 'plan'
>

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

async function fetchShopDetails(session: Session): Promise<ShopDetails | null> {
  try {
    const { data } =
      await createAdminApiGraphqlClient(session).request(SHOP_DETAILS_QUERY)

    if (!data) return null

    const { shop } = data

    return {
      name: shop.name,
      email: shop.email,
      timezone: shop.ianaTimezone,
      currency: shop.currencyCode,
      plan: shop.plan.publicDisplayName,
    }
  } catch (error) {
    addLogContext({ shop_details_error: serializeError(error).message })

    return null
  }
}

async function saveSession(
  session: Session,
  shop: SelectShop | undefined
): Promise<SessionWithShop> {
  const details = shop?.name ? null : await fetchShopDetails(session)
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

  await db.transaction(async tx => {
    const insertShop = tx
      .insert(shopsTable)
      .values({ domain: session.shop, ...details })

    await (details
      ? insertShop.onConflictDoUpdate({
          target: shopsTable.domain,
          set: details,
        })
      : insertShop.onConflictDoNothing())
    await tx
      .insert(sessionsTable)
      .values(values)
      .onConflictDoUpdate({ target: sessionsTable.shop, set: values })
  })

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

        return saveSession(refreshed.session, latest.shop)
      } catch (error) {
        addLogContext({ session_refresh_error: serializeError(error).message })
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

    return saveSession(exchanged.session, latest?.shop)
  })().finally(() => sessionUpdates.delete(shopDomain))

  sessionUpdates.set(shopDomain, update)

  return update
}
