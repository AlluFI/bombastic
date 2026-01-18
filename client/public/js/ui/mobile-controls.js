/**
 * Mobile Touch Controls Module
 * Provides drag-to-move controls and double-tap bomb placement for mobile devices
 */

import { keys } from '../controls.js'

let isInitialized = false
let touchStartTime = 0
let touchStartX = 0
let touchStartY = 0
let lastTapTime = 0
let lastTapX = 0
let lastTapY = 0
const DOUBLE_TAP_DELAY = 300 // ms
const MIN_DRAG_DISTANCE = 20 // pixels

/**
 * Initialize mobile controls
 * Sets up drag-to-move and double-tap handlers on the grid
 */
export function initializeMobileControls() {
  if (isInitialized) return
  
  // Only enable on mobile devices
  if (!isMobileDevice()) {
    return
  }
  
  setupTouchHandlers()
  isInitialized = true
}

/**
 * Check if device is mobile
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
}

/**
 * Setup touch event handlers for drag-to-move and double-tap
 */
function setupTouchHandlers() {
  const gridElement = document.getElementById('grid')
  if (!gridElement) {
    // Wait for grid to be created
    setTimeout(setupTouchHandlers, 100)
    return
  }
  
  let isDragging = false
  let dragStartPos = null
  
  // Touch start - detect initial touch
  gridElement.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return // Only handle single touch
    
    const touch = e.touches[0]
    touchStartTime = Date.now()
    touchStartX = touch.clientX
    touchStartY = touch.clientY
    
    // Store drag start position
    dragStartPos = { x: touch.clientX, y: touch.clientY }
    isDragging = false
    
    // Check for double tap
    const currentTime = Date.now()
    const timeDiff = currentTime - lastTapTime
    const xDiff = Math.abs(touch.clientX - lastTapX)
    const yDiff = Math.abs(touch.clientY - lastTapY)
    
    if (timeDiff < DOUBLE_TAP_DELAY && xDiff < 30 && yDiff < 30) {
      // Double tap detected - place bomb
      e.preventDefault()
      keys.space = true
      // Reset immediately so bomb controller can process it
      setTimeout(() => {
        keys.space = false
      }, 50)
      lastTapTime = 0 // Reset to prevent triple-tap
    } else {
      // First tap - record for potential double tap
      lastTapTime = currentTime
      lastTapX = touch.clientX
      lastTapY = touch.clientY
    }
  }, { passive: false })
  
  // Touch move - handle drag gesture
  gridElement.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartX
    const deltaY = touch.clientY - touchStartY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // If movement exceeds threshold, it's a drag
    if (distance > MIN_DRAG_DISTANCE && !isDragging) {
      isDragging = true
      e.preventDefault()
    }
    
    if (isDragging && dragStartPos) {
      e.preventDefault()
      
      // Calculate drag direction
      const moveX = touch.clientX - dragStartPos.x
      const moveY = touch.clientY - dragStartPos.y
      const absX = Math.abs(moveX)
      const absY = Math.abs(moveY)
      
      // Determine primary direction (prefer horizontal or vertical based on larger movement)
      if (absX > absY) {
        // Horizontal movement
        keys.left = false
        keys.right = false
        if (moveX > 0) {
          keys.right = true
        } else {
          keys.left = true
        }
      } else {
        // Vertical movement
        keys.up = false
        keys.down = false
        if (moveY > 0) {
          keys.down = true
        } else {
          keys.up = true
        }
      }
      
      // Update drag start position for continuous movement
      if (absX > 30 || absY > 30) {
        dragStartPos = { x: touch.clientX, y: touch.clientY }
      }
    }
  }, { passive: false })
  
  // Touch end - stop movement
  gridElement.addEventListener('touchend', (e) => {
    // Clear all movement keys
    keys.up = false
    keys.down = false
    keys.left = false
    keys.right = false
    
    isDragging = false
    dragStartPos = null
  }, { passive: false })
  
  // Touch cancel - stop movement
  gridElement.addEventListener('touchcancel', (e) => {
    keys.up = false
    keys.down = false
    keys.left = false
    keys.right = false
    
    isDragging = false
    dragStartPos = null
  }, { passive: false })
  
  // Prevent default touch behaviors that might interfere
  gridElement.addEventListener('touchstart', (e) => {
    // Only prevent default if it's not a single tap (potential double tap)
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault()
    }
  }, { passive: false })
}

/**
 * Clean up mobile controls
 */
export function cleanupMobileControls() {
  // Event listeners will be automatically cleaned up when elements are removed
  isInitialized = false
}
