/**
 * Instructions Toggle Module
 * Handles showing/hiding the instructions modal overlay
 * Pauses game when instructions are opened
 */

import { isPaused } from './pause.js'
import { socket } from '../main.js'

let isInitialized = false
let wasPausedBeforeInstructions = false

/**
 * Initialize instructions toggle
 */
export function initializeInstructionsToggle() {
  if (isInitialized) return
  
  const infoToggle = document.getElementById('info-toggle')
  const instructionsOverlay = document.getElementById('instructions-overlay')
  const closeButton = document.getElementById('close-instructions')
  
  if (!infoToggle || !instructionsOverlay || !closeButton) {
    return
  }
  
  // Show instructions modal
  infoToggle.addEventListener('click', () => {
    const isExpanded = infoToggle.getAttribute('aria-expanded') === 'true'
    
    if (isExpanded) {
      // Hide instructions and resume if game was running
      hideInstructions()
    } else {
      // Show instructions and pause if game is not already paused
      showInstructions()
    }
  })
  
  // Close button
  closeButton.addEventListener('click', () => {
    hideInstructions()
  })
  
  // Close on overlay click (outside content area)
  instructionsOverlay.addEventListener('click', (e) => {
    if (e.target === instructionsOverlay) {
      hideInstructions()
    }
  })
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !instructionsOverlay.classList.contains('hidden')) {
      hideInstructions()
    }
  })
  
  isInitialized = true
}

function showInstructions() {
  const infoToggle = document.getElementById('info-toggle')
  const instructionsOverlay = document.getElementById('instructions-overlay')
  
  // Remember if game was already paused
  wasPausedBeforeInstructions = isPaused
  
  // Pause game if not already paused
  if (!isPaused && socket) {
    socket.emit('game:pause', {
      paused: true,
      ts: Date.now()
    })
  }
  
  // Show modal
  instructionsOverlay.classList.remove('hidden')
  infoToggle.setAttribute('aria-expanded', 'true')
}

function hideInstructions() {
  const infoToggle = document.getElementById('info-toggle')
  const instructionsOverlay = document.getElementById('instructions-overlay')
  
  // Hide modal
  instructionsOverlay.classList.add('hidden')
  infoToggle.setAttribute('aria-expanded', 'false')
  
  // Resume game if it wasn't paused before opening instructions
  if (!wasPausedBeforeInstructions && isPaused && socket) {
    socket.emit('game:pause', {
      paused: false,
      ts: Date.now()
    })
  }
}
