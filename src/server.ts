import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import logger from '~/utils/logger'

/**
 * Initialize background workers and schedulers
 * Only runs in production - dev mode doesn't need persistent workers
 */
async function initializeWorkers() {
  // Skip in development - workers aren't needed for local testing
  // and cause issues with hot reloading
  if (import.meta.env.DEV) {
    return
  }

  try {
    // Import and start workers
    // These need to be dynamic imports to avoid loading on the client
    const { startWorkers } = await import('~/utils/jobs/reconciliation')

    startWorkers()

    logger.info('[server] workers_initialized', {
      type: 'server',
      workers: ['Webhook', 'Reconciliation'],
      schedulers: ['Google Places', 'Stats Retention'],
    })
  } catch (error) {
    logger.error('[server] workers_init_failed', {
      type: 'server',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    // Don't throw - we don't want this to crash the server
  }
}

// Initialize workers when server starts
initializeWorkers()

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
