/**
 * Metrics Collection Module
 * Tracks game health metrics for monitoring
 */

const { logger } = require('./logger')

// Metrics storage
const metrics = {
  // Connection metrics
  totalConnections: 0,
  totalDisconnections: 0,
  activeConnections: 0,
  
  // Room metrics
  totalRoomsCreated: 0,
  totalRoomsDeleted: 0,
  activeRooms: 0,
  activePlayers: 0,
  
  // Game metrics
  totalGamesStarted: 0,
  totalGamesEnded: 0,
  gameDurations: [], // Array of game durations in ms
  averageGameDuration: 0,
  
  // Error metrics
  errors: {
    total: 0,
    byType: new Map(), // errorCode -> count
    byTime: [] // Array of { timestamp, code, message } for recent errors
  },
  
  // Action metrics
  actions: {
    moves: 0,
    bombs: 0,
    chat: 0,
    powerups: 0
  },
  
  // Rate limiting metrics
  rateLimitHits: {
    MOVE: 0,
    BOMB: 0,
    CHAT: 0,
    POWERUP_PICKUP: 0
  },
  
  // Server metrics
  serverStartTime: Date.now(),
  uptime: 0
}

// Keep only last 1000 game durations to prevent memory issues
const MAX_GAME_DURATIONS = 1000
const MAX_ERROR_HISTORY = 100

/**
 * Record a connection
 */
function recordConnection() {
  metrics.totalConnections++
  metrics.activeConnections++
}

/**
 * Record a disconnection
 */
function recordDisconnection() {
  metrics.totalDisconnections++
  metrics.activeConnections = Math.max(0, metrics.activeConnections - 1)
}

/**
 * Record room creation
 */
function recordRoomCreated() {
  metrics.totalRoomsCreated++
}

/**
 * Record room deletion
 */
function recordRoomDeleted() {
  metrics.totalRoomsDeleted++
}

/**
 * Update active rooms and players count
 * @param {number} roomCount - Current number of active rooms
 * @param {number} playerCount - Current number of active players
 */
function updateActiveCounts(roomCount, playerCount) {
  metrics.activeRooms = roomCount
  metrics.activePlayers = playerCount
}

/**
 * Record game start
 */
function recordGameStart() {
  metrics.totalGamesStarted++
}

/**
 * Record game end and duration
 * @param {number} durationMs - Game duration in milliseconds
 */
function recordGameEnd(durationMs) {
  metrics.totalGamesEnded++
  
  if (durationMs > 0) {
    metrics.gameDurations.push(durationMs)
    
    // Keep only last N durations
    if (metrics.gameDurations.length > MAX_GAME_DURATIONS) {
      metrics.gameDurations.shift()
    }
    
    // Calculate average
    const sum = metrics.gameDurations.reduce((acc, d) => acc + d, 0)
    metrics.averageGameDuration = Math.round(sum / metrics.gameDurations.length)
  }
}

/**
 * Record an error
 * @param {string} code - Error code
 * @param {string} message - Error message
 */
function recordError(code, message) {
  metrics.errors.total++
  
  // Track by type
  const currentCount = metrics.errors.byType.get(code) || 0
  metrics.errors.byType.set(code, currentCount + 1)
  
  // Track recent errors
  metrics.errors.byTime.push({
    timestamp: Date.now(),
    code,
    message: message || code
  })
  
  // Keep only last N errors
  if (metrics.errors.byTime.length > MAX_ERROR_HISTORY) {
    metrics.errors.byTime.shift()
  }
}

/**
 * Record an action
 * @param {string} actionType - Type of action (MOVE, BOMB, CHAT, POWERUP_PICKUP)
 */
function recordAction(actionType) {
  // Map action types to metric keys
  const actionMap = {
    'MOVE': 'moves',
    'BOMB': 'bombs',
    'CHAT': 'chat',
    'POWERUP_PICKUP': 'powerups'
  }
  
  const actionKey = actionMap[actionType] || actionType.toLowerCase()
  if (metrics.actions[actionKey] !== undefined) {
    metrics.actions[actionKey]++
  }
}

/**
 * Record a rate limit hit
 * @param {string} actionType - Type of action that was rate limited
 */
function recordRateLimitHit(actionType) {
  if (metrics.rateLimitHits[actionType] !== undefined) {
    metrics.rateLimitHits[actionType]++
  }
}

/**
 * Get current metrics snapshot
 * @returns {Object} Current metrics
 */
function getMetrics() {
  // Calculate uptime
  metrics.uptime = Math.floor((Date.now() - metrics.serverStartTime) / 1000)
  
  // Convert error map to object for JSON serialization
  const errorsByType = {}
  metrics.errors.byType.forEach((count, code) => {
    errorsByType[code] = count
  })
  
  // Get recent errors (last 10)
  const recentErrors = metrics.errors.byTime
    .slice(-10)
    .map(e => ({
      timestamp: e.timestamp,
      code: e.code,
      message: e.message
    }))
  
  return {
    timestamp: Date.now(),
    uptime: metrics.uptime,
    
    // Connection metrics
    connections: {
      total: metrics.totalConnections,
      active: metrics.activeConnections,
      totalDisconnections: metrics.totalDisconnections,
      connectionRate: metrics.uptime > 0 
        ? Math.round((metrics.totalConnections / metrics.uptime) * 60) // per minute
        : 0
    },
    
    // Room metrics
    rooms: {
      totalCreated: metrics.totalRoomsCreated,
      totalDeleted: metrics.totalRoomsDeleted,
      active: metrics.activeRooms,
      activePlayers: metrics.activePlayers
    },
    
    // Game metrics
    games: {
      totalStarted: metrics.totalGamesStarted,
      totalEnded: metrics.totalGamesEnded,
      averageDuration: metrics.averageGameDuration,
      averageDurationFormatted: formatDuration(metrics.averageGameDuration),
      totalDurationsTracked: metrics.gameDurations.length
    },
    
    // Error metrics
    errors: {
      total: metrics.errors.total,
      byType: errorsByType,
      recent: recentErrors,
      errorRate: metrics.uptime > 0
        ? Math.round((metrics.errors.total / metrics.uptime) * 60) // per minute
        : 0
    },
    
    // Action metrics
    actions: {
      ...metrics.actions,
      total: Object.values(metrics.actions).reduce((sum, count) => sum + count, 0)
    },
    
    // Rate limiting metrics
    rateLimiting: {
      ...metrics.rateLimitHits,
      total: Object.values(metrics.rateLimitHits).reduce((sum, count) => sum + count, 0)
    }
  }
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Reset all metrics (useful for testing)
 */
function resetMetrics() {
  metrics.totalConnections = 0
  metrics.totalDisconnections = 0
  metrics.activeConnections = 0
  metrics.totalRoomsCreated = 0
  metrics.totalRoomsDeleted = 0
  metrics.activeRooms = 0
  metrics.activePlayers = 0
  metrics.totalGamesStarted = 0
  metrics.totalGamesEnded = 0
  metrics.gameDurations = []
  metrics.averageGameDuration = 0
  metrics.errors.total = 0
  metrics.errors.byType.clear()
  metrics.errors.byTime = []
  metrics.actions.moves = 0
  metrics.actions.bombs = 0
  metrics.actions.chat = 0
  metrics.actions.powerups = 0
  metrics.rateLimitHits.MOVE = 0
  metrics.rateLimitHits.BOMB = 0
  metrics.rateLimitHits.CHAT = 0
  metrics.rateLimitHits.POWERUP_PICKUP = 0
  metrics.serverStartTime = Date.now()
}

module.exports = {
  recordConnection,
  recordDisconnection,
  recordRoomCreated,
  recordRoomDeleted,
  updateActiveCounts,
  recordGameStart,
  recordGameEnd,
  recordError,
  recordAction,
  recordRateLimitHit,
  getMetrics,
  resetMetrics
}
