/**
 * Rate Limiting Middleware for Socket.io Events
 * 
 * Prevents abuse by limiting the frequency of socket events per client.
 * Uses a sliding window algorithm.
 */

const CONSTANTS = require('./constants');
const metrics = require('./metrics');

// Store rate limit data per socket
const rateLimitStore = new Map();

/**
 * Cleans up rate limit data for disconnected sockets
 * @param {string} socketId - Socket ID to clean up
 */
function cleanupRateLimit(socketId) {
  rateLimitStore.delete(socketId);
}

/**
 * Checks if an action is within rate limits
 * @param {string} socketId - Socket ID
 * @param {string} action - Action type (MOVE, BOMB, CHAT, etc.)
 * @returns {boolean} - True if within limits, false if rate limited
 */
function checkRateLimit(socketId, action) {
  const limits = CONSTANTS.RATE_LIMITS[action];
  if (!limits) {
    // No rate limit defined for this action, allow it
    return true;
  }
  
  const now = Date.now();
  const key = `${socketId}:${action}`;
  
  // Get or create rate limit data for this socket+action
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      requests: [],
      windowStart: now,
    });
  }
  
  const data = rateLimitStore.get(key);
  
  // Remove requests outside the time window
  const windowStart = now - limits.window;
  data.requests = data.requests.filter(timestamp => timestamp > windowStart);
  
  // Check if we've exceeded the limit
  if (data.requests.length >= limits.max) {
    metrics.recordRateLimitHit(action);
    return false; // Rate limited
  }
  
  // Add current request
  data.requests.push(now);
  return true; // Within limits
}

/**
 * Middleware function to rate limit socket events
 * @param {string} action - Action type to rate limit
 * @returns {Function} - Middleware function
 */
function rateLimitMiddleware(action) {
  return (socket, next) => {
    const originalOn = socket.on.bind(socket);
    
    socket.on = function(event, handler) {
      if (event === action) {
        // Wrap handler with rate limiting
        const wrappedHandler = (...args) => {
          if (!checkRateLimit(socket.id, action)) {
            socket.emit('error', { 
              message: `Rate limit exceeded for ${action}. Please slow down.` 
            });
            return;
          }
          handler(...args);
        };
        return originalOn(event, wrappedHandler);
      }
      return originalOn(event, handler);
    };
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      cleanupRateLimit(socket.id);
    });
    
    if (next) next();
  };
}

/**
 * Simple rate limit check (for use in handlers)
 * @param {Object} socket - Socket.io socket
 * @param {string} action - Action type
 * @returns {boolean} - True if allowed, false if rate limited
 */
function isRateLimited(socket, action) {
  if (!checkRateLimit(socket.id, action)) {
    // Don't show error notification for BOMB rate limits (silently ignore)
    if (action !== 'BOMB') {
      socket.emit('error', { 
        message: `Rate limit exceeded for ${action}. Please slow down.` 
      });
    }
    return true;
  }
  return false;
}

module.exports = {
  rateLimitMiddleware,
  isRateLimited,
  checkRateLimit,
  cleanupRateLimit,
};
