/**
 * Authentication Module
 * Simple session-based authentication for socket connections
 */

const { logger } = require('./logger')
const crypto = require('crypto')

// Store active sessions (in production, use Redis or database)
const sessions = new Map()

// Session expiration time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

/**
 * Generate a new session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create a new session for a socket
 * @param {string} socketId - Socket ID
 * @param {Object} userData - Optional user data (name, etc.)
 * @returns {string} Session ID
 */
function createSession(socketId, userData = {}) {
  const sessionId = generateSessionId()
  const session = {
    id: sessionId,
    socketId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    userData: {
      name: userData.name || null,
      ...userData
    }
  }
  
  sessions.set(sessionId, session)
  logger.debug({ sessionId, socketId }, 'Session created')
  
  return sessionId
}

/**
 * Get session by session ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session object or null if not found/expired
 */
function getSession(sessionId) {
  if (!sessionId) return null
  
  const session = sessions.get(sessionId)
  if (!session) return null
  
  // Check if session expired
  const now = Date.now()
  if (now - session.lastActivity > SESSION_EXPIRY_MS) {
    sessions.delete(sessionId)
    logger.debug({ sessionId }, 'Session expired')
    return null
  }
  
  // Update last activity
  session.lastActivity = now
  return session
}

/**
 * Update session user data
 * @param {string} sessionId - Session ID
 * @param {Object} userData - User data to update
 */
function updateSession(sessionId, userData) {
  const session = getSession(sessionId)
  if (session) {
    session.userData = { ...session.userData, ...userData }
    session.lastActivity = Date.now()
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 */
function deleteSession(sessionId) {
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId)
    logger.debug({ sessionId }, 'Session deleted')
  }
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now()
  let cleaned = 0
  
  sessions.forEach((session, sessionId) => {
    if (now - session.lastActivity > SESSION_EXPIRY_MS) {
      sessions.delete(sessionId)
      cleaned++
    }
  })
  
  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned up expired sessions')
  }
}

/**
 * Get session by socket ID
 * @param {string} socketId - Socket ID
 * @returns {Object|null} Session object or null
 */
function getSessionBySocketId(socketId) {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.socketId === socketId) {
      return session
    }
  }
  return null
}

/**
 * Delete session by socket ID
 * @param {string} socketId - Socket ID
 */
function deleteSessionBySocketId(socketId) {
  const session = getSessionBySocketId(socketId)
  if (session) {
    deleteSession(session.id)
  }
}

// Cleanup expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000)

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getSessionBySocketId,
  deleteSessionBySocketId,
  cleanupExpiredSessions
}
