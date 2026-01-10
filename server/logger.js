/**
 * Centralized Logging Module
 * 
 * Provides structured logging using Pino with environment-based log levels.
 * Supports both development (pretty printed) and production (JSON) formats.
 */

const pino = require('pino');

// Determine log level from environment (default: info for production, debug for development)
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger with appropriate configuration
const loggerConfig = {
  level: LOG_LEVEL,
  // Use pretty printing in development, JSON in production
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Base metadata to include in all logs
  base: {
    env: process.env.NODE_ENV || 'development',
  },
};

// Create the logger instance
const logger = pino(loggerConfig);

/**
 * Helper functions for common logging patterns
 */

/**
 * Log game events (info level)
 * @param {string} message - Log message
 * @param {Object} context - Additional context (player, room, etc.)
 */
function logGameEvent(message, context = {}) {
  logger.info({ type: 'game_event', ...context }, message);
}

/**
 * Log player actions (info level)
 * @param {string} playerId - Player ID
 * @param {string} playerName - Player name
 * @param {string} action - Action description
 * @param {Object} context - Additional context
 */
function logPlayerAction(playerId, playerName, action, context = {}) {
  logger.info(
    { type: 'player_action', playerId, playerName, ...context },
    `Player ${playerName} (${playerId}): ${action}`
  );
}

/**
 * Log room events (info level)
 * @param {string} roomId - Room code
 * @param {string} event - Event description
 * @param {Object} context - Additional context
 */
function logRoomEvent(roomId, event, context = {}) {
  logger.info({ type: 'room_event', roomId, ...context }, `Room ${roomId}: ${event}`);
}

/**
 * Log NPC actions (debug level - can be filtered)
 * @param {string} npcId - NPC ID
 * @param {string} npcName - NPC name
 * @param {string} action - Action description
 * @param {Object} context - Additional context
 */
function logNPCAction(npcId, npcName, action, context = {}) {
  logger.debug(
    { type: 'npc_action', npcId, npcName, ...context },
    `NPC ${npcName} (${npcId}): ${action}`
  );
}

/**
 * Log socket events (debug level)
 * @param {string} socketId - Socket ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function logSocketEvent(socketId, event, data = {}) {
  logger.debug({ type: 'socket_event', socketId, event, ...data }, `Socket ${socketId}: ${event}`);
}

/**
 * Log errors with full context (error level)
 * @param {Error|string} error - Error object or message
 * @param {Object} context - Additional context
 */
function logError(error, context = {}) {
  if (error instanceof Error) {
    logger.error({ type: 'error', err: error, ...context }, error.message);
  } else {
    logger.error({ type: 'error', ...context }, error);
  }
}

/**
 * Log warnings (warn level)
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
function logWarning(message, context = {}) {
  logger.warn({ type: 'warning', ...context }, message);
}

// Export both the raw logger and helper functions
module.exports = {
  // Raw Pino logger instance (for advanced usage)
  logger,
  
  // Helper functions
  logGameEvent,
  logPlayerAction,
  logRoomEvent,
  logNPCAction,
  logSocketEvent,
  logError,
  logWarning,
  
  // Direct access to log levels
  debug: (msg, context) => logger.debug(context, msg),
  info: (msg, context) => logger.info(context, msg),
  warn: (msg, context) => logger.warn(context, msg),
  error: (msg, context) => logger.error(context, msg),
};
