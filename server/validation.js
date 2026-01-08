/**
 * Input Validation and Sanitization Utilities
 * 
 * Provides functions to validate and sanitize user inputs to prevent
 * security vulnerabilities and invalid game state.
 */

const CONSTANTS = require('./constants');

/**
 * Sanitizes a player name
 * @param {string} name - Player name to sanitize
 * @returns {string|null} - Sanitized name or null if invalid
 */
function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  
  // Trim whitespace
  name = name.trim();
  
  // Check length
  if (name.length < CONSTANTS.MIN_PLAYER_NAME_LENGTH || 
      name.length > CONSTANTS.MAX_PLAYER_NAME_LENGTH) {
    return null;
  }
  
  // Remove potentially dangerous characters (XSS prevention)
  // Allow: letters, numbers, spaces, hyphens, underscores
  name = name.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  
  // Ensure it's not empty after sanitization
  if (name.length < CONSTANTS.MIN_PLAYER_NAME_LENGTH) {
    return null;
  }
  
  return name;
}

/**
 * Sanitizes a chat message
 * @param {string} message - Chat message to sanitize
 * @returns {string|null} - Sanitized message or null if invalid
 */
function sanitizeChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }
  
  // Trim whitespace
  message = message.trim();
  
  // Check length
  if (message.length < CONSTANTS.MIN_CHAT_MESSAGE_LENGTH || 
      message.length > CONSTANTS.MAX_CHAT_MESSAGE_LENGTH) {
    return null;
  }
  
  // Remove potentially dangerous characters (XSS prevention)
  // Allow most characters but remove script tags and dangerous HTML
  message = message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  message = message.replace(/<[^>]+>/g, ''); // Remove all HTML tags
  
  // Ensure it's not empty after sanitization
  if (message.length < CONSTANTS.MIN_CHAT_MESSAGE_LENGTH) {
    return null;
  }
  
  return message;
}

/**
 * Validates grid coordinates
 * @param {number} x - Row coordinate
 * @param {number} y - Column coordinate
 * @returns {boolean} - True if valid coordinates
 */
function validateCoordinates(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return false;
  }
  
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }
  
  if (x < 0 || x >= CONSTANTS.GRID_ROWS || 
      y < 0 || y >= CONSTANTS.GRID_COLS) {
    return false;
  }
  
  return true;
}

/**
 * Validates room code format
 * @param {string} roomCode - Room code to validate
 * @returns {boolean} - True if valid room code format
 */
function validateRoomCode(roomCode) {
  if (!roomCode || typeof roomCode !== 'string') {
    return false;
  }
  
  if (roomCode.length !== CONSTANTS.ROOM_CODE_LENGTH) {
    return false;
  }
  
  // Room codes should be alphanumeric uppercase
  if (!/^[A-Z0-9]+$/.test(roomCode)) {
    return false;
  }
  
  return true;
}

/**
 * Validates player movement data
 * @param {Object} moveData - Movement data { x, y }
 * @returns {boolean} - True if valid
 */
function validateMovement(moveData) {
  if (!moveData || typeof moveData !== 'object') {
    return false;
  }
  
  return validateCoordinates(moveData.x, moveData.y);
}

/**
 * Validates bomb placement data
 * @param {Object} bombData - Bomb data { x, y, playerId }
 * @returns {boolean} - True if valid
 */
function validateBombPlacement(bombData) {
  if (!bombData || typeof bombData !== 'object') {
    return false;
  }
  
  if (!validateCoordinates(bombData.x, bombData.y)) {
    return false;
  }
  
  if (!bombData.playerId || typeof bombData.playerId !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * Validates power-up pickup data
 * @param {Object} pickupData - Pickup data { powerupId, playerId, x, y }
 * @returns {boolean} - True if valid
 */
function validatePowerupPickup(pickupData) {
  if (!pickupData || typeof pickupData !== 'object') {
    return false;
  }
  
  if (!pickupData.powerupId || typeof pickupData.powerupId !== 'string') {
    return false;
  }
  
  if (!pickupData.playerId || typeof pickupData.playerId !== 'string') {
    return false;
  }
  
  return validateCoordinates(pickupData.x, pickupData.y);
}

module.exports = {
  sanitizePlayerName,
  sanitizeChatMessage,
  validateCoordinates,
  validateRoomCode,
  validateMovement,
  validateBombPlacement,
  validatePowerupPickup,
};
