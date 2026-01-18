/**
 * Swipe Prevention Module
 * Prevents pull-to-refresh on mobile and triggers pause instead when swiping from top
 */

import { isPaused } from './pause.js'
import { socket } from '../main.js'

let isInitialized = false
let touchStartY = 0
let touchStartX = 0
let isSwipeFromTop = false
const SWIPE_THRESHOLD = 50 // pixels to detect swipe down

/**
 * Check if game screen is currently active
 */
function isGameScreenActive() {
    const gameScreen = document.getElementById('game-screen')
    return gameScreen && !gameScreen.classList.contains('hidden')
}

/**
 * Initialize swipe prevention
 */
export function initializeSwipePrevention() {
    if (isInitialized) return
    if (!isMobileDevice()) return

    // Prevent pull-to-refresh with CSS
    document.body.style.overscrollBehaviorY = 'none'
    document.documentElement.style.overscrollBehaviorY = 'none'
    
    // Prevent default touchmove behavior on document when at top
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: false })
    
    // Prevent page reload on beforeunload when in game (but allow navigation)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    isInitialized = true
}

/**
 * Check if device is mobile
 */
function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * Handle touch start
 */
function handleTouchStart(e) {
    if (!isGameScreenActive()) return
    
    touchStartY = e.touches[0].clientY
    touchStartX = e.touches[0].clientX
    isSwipeFromTop = touchStartY < 100 // Start near top of screen (within 100px)
}

/**
 * Handle touch move - detect swipe down from top
 */
function handleTouchMove(e) {
    if (!isGameScreenActive() || !isSwipeFromTop) return
    
    const touchY = e.touches[0].clientY
    const touchX = e.touches[0].clientX
    const deltaY = touchY - touchStartY
    const deltaX = Math.abs(touchX - touchStartX)
    
    // Only prevent if swiping down (deltaY > 0) and mostly vertical (deltaX < deltaY)
    if (deltaY > SWIPE_THRESHOLD && deltaY > deltaX) {
        // Swipe down from top detected - prevent default and pause if not already paused
        e.preventDefault()
        
        if (!isPaused) {
            // Pause the game instead of refreshing
            if (socket) {
                socket.emit('game:pause', {
                    paused: true,
                    ts: Date.now()
                })
            }
        }
        
        isSwipeFromTop = false // Reset to prevent multiple triggers
    }
}

/**
 * Handle touch end
 */
function handleTouchEnd(e) {
    isSwipeFromTop = false
}

/**
 * Handle beforeunload - prevent accidental refresh when in game
 */
function handleBeforeUnload(e) {
    if (!isGameScreenActive()) return
    
    // Only prevent if game is not paused (user might want to quit intentionally)
    if (!isPaused) {
        // This won't work in all browsers, but helps in some
        e.preventDefault()
        e.returnValue = '' // Chrome requires returnValue
    }
}
