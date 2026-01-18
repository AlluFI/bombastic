/**
 * Global Error Handler
 * Handles unhandled errors and provides user-friendly error messages
 */

import { showError } from './ui/notifications.js'

/**
 * Initialize global error handlers
 */
export function initializeErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    
    // Prevent default browser error handling
    event.preventDefault()
    
    // Show user-friendly error message
    const errorMessage = getErrorMessage(event.reason)
    showError(`An unexpected error occurred: ${errorMessage}`)
  })
  
  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error)
    
    // Prevent default browser error handling
    event.preventDefault()
    
    // Show user-friendly error message
    const errorMessage = getErrorMessage(event.error || event.message)
    showError(`An unexpected error occurred: ${errorMessage}`)
    
    // Return false to prevent default browser error handling
    return false
  })
  
  // Handle console errors (for debugging)
  const originalConsoleError = console.error
  console.error = function(...args) {
    originalConsoleError.apply(console, args)
    
    // Don't show notifications for expected errors (like connection errors that are already handled)
    const errorString = args.join(' ')
    if (errorString.includes('Socket connection error') || 
        errorString.includes('reconnect') ||
        errorString.includes('room:created')) {
      return
    }
    
    // For other errors, log but don't show notification (to avoid spam)
    // The global error handlers above will catch actual unhandled errors
  }
}

/**
 * Get user-friendly error message from error object
 * @param {Error|string|any} error - Error object or message
 * @returns {string} User-friendly error message
 */
function getErrorMessage(error) {
  if (!error) {
    return 'Unknown error'
  }
  
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error
  }
  
  // If it's an Error object, get the message
  if (error instanceof Error) {
    return error.message || 'An error occurred'
  }
  
  // If it's an object with a message property
  if (error.message) {
    return error.message
  }
  
  // Try to stringify it
  try {
    return String(error)
  } catch {
    return 'An unexpected error occurred'
  }
}

/**
 * Handle socket errors with user-friendly messages
 * @param {Object} errorData - Error data from server
 * @returns {string} User-friendly error message
 */
export function getSocketErrorMessage(errorData) {
  if (!errorData) {
    return 'An error occurred'
  }
  
  // If message is provided, use it
  if (errorData.message) {
    return errorData.message
  }
  
  // Map error codes to user-friendly messages
  const errorMessages = {
    'ROOM_NOT_FOUND': 'Room not found. It may have been closed.',
    'ROOM_FULL': 'Room is full. Please try another room.',
    'NAME_TAKEN': 'This name is already taken in this room. Please choose another name.',
    'INVALID_DATA': 'Invalid data provided. Please try again.',
    'INVALID_PLAYER_NAME': 'Invalid player name. Please use 2-20 characters.',
    'INVALID_MOVEMENT': 'Invalid movement. Please try again.',
    'INVALID_BOMB_PLACEMENT': 'Cannot place bomb here.',
    'RATE_LIMIT_EXCEEDED': 'Action too fast. Please slow down.',
    'NOT_HOST': 'Only the host can perform this action.',
    'GAME_ALREADY_RUNNING': 'Game is already running.',
    'NOT_ENOUGH_PLAYERS': 'Need at least 2 players to start the game.',
    'RECONNECTION_EXPIRED': 'Reconnection time expired. Please join a new game.',
    'PLAYER_NOT_FOUND': 'Player not found.',
    'INVALID_ROOM_CODE': 'Invalid room code. Please check and try again.',
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
  }
  
  // Return mapped message or default
  return errorMessages[errorData.code] || errorData.code || 'An error occurred'
}
