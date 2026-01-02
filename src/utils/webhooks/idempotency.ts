import { redis } from '~/utils/redis'
import logger from '~/utils/logger'

const WEBHOOK_KEY_PREFIX = 'webhook:processed:'
const TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

/**
 * Check if a webhook has already been processed
 * @param webhookId - The X-Shopify-Webhook-Id header value
 * @returns true if already processed, false otherwise
 */
export async function isWebhookProcessed(webhookId: string): Promise<boolean> {
  try {
    return (await redis.exists(`${WEBHOOK_KEY_PREFIX}${webhookId}`)) === 1
  } catch (error) {
    // If Redis fails, log error but return false to allow processing
    // (better to potentially process a duplicate than to drop the webhook)
    logger.error('Failed to check webhook idempotency', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return false
  }
}

/**
 * Mark a webhook as processed with TTL expiration
 * @param webhookId - The X-Shopify-Webhook-Id header value
 */
export async function markWebhookProcessed(webhookId: string): Promise<void> {
  try {
    await redis.set(`${WEBHOOK_KEY_PREFIX}${webhookId}`, '1', 'EX', TTL_SECONDS)
  } catch (error) {
    // Log but don't throw - failing to mark shouldn't break webhook processing
    logger.error('Failed to mark webhook as processed', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Check webhook timestamp and log warning if delayed more than 24 hours
 * @param triggeredAt - ISO timestamp from X-Shopify-Triggered-At header
 * @param webhookTopic - The webhook topic for logging context
 * @param shopDomain - The shop domain for logging context
 * @returns true if webhook is delayed (>24 hours old), false otherwise
 */
export function checkWebhookDelay(
  triggeredAt: string | null,
  webhookTopic: string | null,
  shopDomain: string | null
): boolean {
  if (!triggeredAt) {
    return false
  }

  const webhookTime = new Date(triggeredAt).getTime()
  const now = Date.now()
  const delayMs = now - webhookTime
  const delayHours = delayMs / (1000 * 60 * 60)

  if (delayHours > 24) {
    logger.warn('Webhook received with significant delay', {
      webhookTopic,
      shopDomain,
      triggeredAt,
      delayHours: Math.round(delayHours * 10) / 10,
    })

    return true
  }

  return false
}
