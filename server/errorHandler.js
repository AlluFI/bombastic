/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling and logging for the game server.
 */

/**
 * Standard error response format
 * @param {string} message - Error message
 * @param {string} code - Error code (optional)
 * @returns {Object} - Error object
 */
function createError(message, code = 'UNKNOWN_ERROR') {
  return {
    error: true,
    message,
    code,
    timestamp: Date.now(),
  };
}

/**
 * Emits an error to a socket
 * @param {Object} socket - Socket.io socket
 * @param {string} message - Error message
 * @param {string} code - Error code (optional)
 */
function emitError(socket, message, code) {
  if (!socket || !socket.emit) {
    console.error('Invalid socket provided to emitError');
    return;
  }
  
  const error = createError(message, code);
  socket.emit('error', error);
  
  // Log error for debugging
  console.error(`[ERROR] ${code}: ${message} (Socket: ${socket.id})`);
}

/**
 * Validates and handles errors for room operations
 * @param {Object} socket - Socket.io socket
 * @param {string} roomCode - Room code
 * @param {Map} rooms - Rooms map
 * @returns {Object|null} - Room object or null if invalid
 */
function validateRoom(socket, roomCode, rooms) {
  if (!roomCode) {
    emitError(socket, 'Room code is required', 'MISSING_ROOM_CODE');
    return null;
  }
  
  if (!rooms) {
    emitError(socket, 'Server error: rooms not available', 'SERVER_ERROR');
    return null;
  }
  
  const room = rooms.get(roomCode);
  if (!room) {
    emitError(socket, 'Room not found', 'ROOM_NOT_FOUND');
    return null;
  }
  
  return room;
}

/**
 * Validates and handles errors for player operations
 * @param {Object} socket - Socket.io socket
 * @param {Object} room - Room object
 * @returns {Object|null} - Player object or null if invalid
 */
function validatePlayer(socket, room) {
  if (!room) {
    emitError(socket, 'Room not found', 'ROOM_NOT_FOUND');
    return null;
  }
  
  if (!room.players) {
    emitError(socket, 'Server error: room players not available', 'SERVER_ERROR');
    return null;
  }
  
  const player = room.players.get(socket.id);
  if (!player) {
    emitError(socket, 'Player not found in room', 'PLAYER_NOT_FOUND');
    return null;
  }
  
  return player;
}

/**
 * Wraps an async handler with error handling
 * @param {Function} handler - Async handler function
 * @returns {Function} - Wrapped handler
 */
function asyncHandler(handler) {
  return async (socket, ...args) => {
    try {
      await handler(socket, ...args);
    } catch (error) {
      console.error(`[ERROR] Unhandled error in handler:`, error);
      emitError(socket, 'An unexpected error occurred', 'INTERNAL_ERROR');
    }
  };
}

/**
 * Logs an error with context
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 */
function logError(message, context = {}) {
  console.error(`[ERROR] ${message}`, context);
}

/**
 * Logs a warning with context
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
function logWarning(message, context = {}) {
  console.warn(`[WARN] ${message}`, context);
}

module.exports = {
  createError,
  emitError,
  validateRoom,
  validatePlayer,
  asyncHandler,
  logError,
  logWarning,
};
