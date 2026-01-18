/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling and logging for the game server.
 */

const { logError, logWarning } = require('./logger');
const metrics = require('./metrics');

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
    logError('Invalid socket provided to emitError', { code });
    return;
  }
  
  const error = createError(message, code);
  socket.emit('error', error);
  
  // Record error in metrics
  metrics.recordError(code || 'UNKNOWN_ERROR', message);
  
  // Log error for debugging
  logError(message, { code, socketId: socket.id, errorCode: code });
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

module.exports = {
  createError,
  emitError,
  validateRoom,
  validatePlayer,
};
