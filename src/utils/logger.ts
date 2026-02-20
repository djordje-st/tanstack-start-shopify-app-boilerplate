import winston from 'winston'

const isDevelopment = process.env.NODE_ENV === 'development'

const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isDevelopment ? winston.format.simple() : winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? ` ${JSON.stringify(meta)}`
                : ''

              return `${timestamp} [${level}]: ${message}${metaStr}`
            })
          )
        : winston.format.json(),
    }),
  ],
})

export default logger
