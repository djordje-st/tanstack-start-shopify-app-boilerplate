import { redis } from '~/utils/redis'
import logger from '~/utils/logger'

const WEBHOOK_KEY_PREFIX = 'webhook:processed:'
const TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

/**
 * Check if a webhook event has already been processed
 * Uses X-Shopify-Event-Id for duplicate detection as recommended by Shopify docs
 * @param eventId - The X-Shopify-Event-Id header value
 * @returns true if already processed, false otherwise
 */
export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  try {
    return (await redis.exists(`${WEBHOOK_KEY_PREFIX}${eventId}`)) === 1
  } catch (error) {
    logger.error('[webhook] Failed to check idempotency', {
      type: 'webhook',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    // Fail open - allow processing if Redis check fails
    return false
  }
}

/**
 * Mark a webhook event as processed with TTL expiration
 * @param eventId - The X-Shopify-Event-Id header value
 */
export async function markWebhookProcessed(eventId: string): Promise<void> {
  try {
    await redis.set(`${WEBHOOK_KEY_PREFIX}${eventId}`, '1', 'EX', TTL_SECONDS)
  } catch (error) {
    logger.error('[webhook] Failed to mark as processed', {
      type: 'webhook',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Check webhook timestamp and determine if it's significantly delayed
 * Logs warning if delayed more than 24 hours
 * @param triggeredAt - ISO timestamp from X-Shopify-Triggered-At header
 * @param topic - The webhook topic for logging context
 * @param domain - The shop domain for logging context
 * @returns delay in hours, or null if no timestamp
 */
export function getWebhookDelayHours(
  triggeredAt: string | null,
  topic: string | null,
  domain: string | null
): number | null {
  if (!triggeredAt) {
    return null
  }

  const webhookTime = new Date(triggeredAt).getTime()
  const now = Date.now()
  const delayMs = now - webhookTime
  const delayHours = delayMs / (1000 * 60 * 60)

  if (delayHours > 24) {
    logger.warn('[webhook] Received with significant delay (>24h)', {
      type: 'webhook',
      topic,
      domain,
      triggeredAt,
      delayHours: Math.round(delayHours * 10) / 10,
    })
  }

  return delayHours
}
