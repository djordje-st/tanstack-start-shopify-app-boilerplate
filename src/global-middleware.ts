import { registerGlobalMiddleware } from '@tanstack/react-start'
import { authMiddleware } from './utils/middleware/auth-middleware'
import { loggingMiddleware } from './utils/middleware/logging-middleware'

registerGlobalMiddleware({
  middleware: [
    // loggingMiddleware,
    authMiddleware,
  ],
})
