/**
 * Mobile Touch Controls Module
 * Provides on-screen directional pad and bomb button for mobile devices
 */

import { keys } from '../controls.js'

let isInitialized = false
let activeTouchId = null
let touchStartPositions = {}

/**
 * Initialize mobile controls
 * Creates on-screen directional pad and bomb button
 */
export function initializeMobileControls() {
  if (isInitialized) return
  
  // Only show on mobile devices
  if (!isMobileDevice()) {
    return
  }
  
  createMobileControls()
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
 * Create mobile controls HTML
 */
function createMobileControls() {
  const gameScreen = document.getElementById('game-screen')
  if (!gameScreen) return
  
  // Create controls container
  const controlsContainer = document.createElement('div')
  controlsContainer.id = 'mobile-controls'
  controlsContainer.setAttribute('aria-label', 'Mobile game controls')
  
  // Create directional pad
  const dpad = document.createElement('div')
  dpad.className = 'mobile-dpad'
  dpad.innerHTML = `
    <button class="dpad-btn dpad-up" aria-label="Move up" data-direction="up">
      <span>↑</span>
    </button>
    <div class="dpad-middle">
      <button class="dpad-btn dpad-left" aria-label="Move left" data-direction="left">
        <span>←</span>
      </button>
      <button class="dpad-btn dpad-right" aria-label="Move right" data-direction="right">
        <span>→</span>
      </button>
    </div>
    <button class="dpad-btn dpad-down" aria-label="Move down" data-direction="down">
      <span>↓</span>
    </button>
  `
  
  // Create bomb button
  const bombButton = document.createElement('button')
  bombButton.className = 'mobile-bomb-btn'
  bombButton.setAttribute('aria-label', 'Place bomb')
  bombButton.innerHTML = '<span>💣</span>'
  
  controlsContainer.appendChild(dpad)
  controlsContainer.appendChild(bombButton)
  gameScreen.appendChild(controlsContainer)
}

/**
 * Setup touch event handlers
 */
function setupTouchHandlers() {
  const controlsContainer = document.getElementById('mobile-controls')
  if (!controlsContainer) return
  
  // Handle directional pad buttons
  const dpadButtons = controlsContainer.querySelectorAll('.dpad-btn')
  dpadButtons.forEach(button => {
    const direction = button.dataset.direction
    
    // Touch start
    button.addEventListener('touchstart', (e) => {
      e.preventDefault()
      e.stopPropagation()
      activateDirection(direction)
      button.classList.add('active')
    }, { passive: false })
    
    // Touch end
    button.addEventListener('touchend', (e) => {
      e.preventDefault()
      e.stopPropagation()
      deactivateDirection(direction)
      button.classList.remove('active')
    }, { passive: false })
    
    // Touch cancel (when touch moves outside button)
    button.addEventListener('touchcancel', (e) => {
      e.preventDefault()
      e.stopPropagation()
      deactivateDirection(direction)
      button.classList.remove('active')
    }, { passive: false })
    
    // Mouse events for testing on desktop
    button.addEventListener('mousedown', (e) => {
      e.preventDefault()
      activateDirection(direction)
      button.classList.add('active')
    })
    
    button.addEventListener('mouseup', (e) => {
      e.preventDefault()
      deactivateDirection(direction)
      button.classList.remove('active')
    })
    
    button.addEventListener('mouseleave', (e) => {
      e.preventDefault()
      deactivateDirection(direction)
      button.classList.remove('active')
    })
  })
  
  // Handle bomb button
  const bombButton = controlsContainer.querySelector('.mobile-bomb-btn')
  if (bombButton) {
    bombButton.addEventListener('touchstart', (e) => {
      e.preventDefault()
      e.stopPropagation()
      keys.space = true
      bombButton.classList.add('active')
    }, { passive: false })
    
    bombButton.addEventListener('touchend', (e) => {
      e.preventDefault()
      e.stopPropagation()
      keys.space = false
      bombButton.classList.remove('active')
    }, { passive: false })
    
    bombButton.addEventListener('touchcancel', (e) => {
      e.preventDefault()
      e.stopPropagation()
      keys.space = false
      bombButton.classList.remove('active')
    }, { passive: false })
    
    // Mouse events for testing
    bombButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
      keys.space = true
      bombButton.classList.add('active')
    })
    
    bombButton.addEventListener('mouseup', (e) => {
      e.preventDefault()
      keys.space = false
      bombButton.classList.remove('active')
    })
  }
  
  // Prevent default touch behaviors on the controls container
  controlsContainer.addEventListener('touchmove', (e) => {
    e.preventDefault()
  }, { passive: false })
}

/**
 * Activate a direction
 */
function activateDirection(direction) {
  switch (direction) {
    case 'up':
      keys.up = true
      break
    case 'down':
      keys.down = true
      break
    case 'left':
      keys.left = true
      break
    case 'right':
      keys.right = true
      break
  }
}

/**
 * Deactivate a direction
 */
function deactivateDirection(direction) {
  switch (direction) {
    case 'up':
      keys.up = false
      break
    case 'down':
      keys.down = false
      break
    case 'left':
      keys.left = false
      break
    case 'right':
      keys.right = false
      break
  }
}

/**
 * Clean up mobile controls
 */
export function cleanupMobileControls() {
  const controlsContainer = document.getElementById('mobile-controls')
  if (controlsContainer) {
    controlsContainer.remove()
  }
  isInitialized = false
}
