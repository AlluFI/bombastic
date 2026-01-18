import { showMenuScreen } from "./menu.js"
import {socket} from "../main.js"
import { clearAllPlayers } from "../player.js"
import { resetPlayer } from "../main.js"
import { playSound } from "../audio/soundManager.js"

const pauseOverlay = document.getElementById('pause-overlay')
const pauseMessage = document.getElementById('pause-message')
const resumeButton = document.getElementById('resume-id')
const quitButton = document.getElementById('quit-button')

//global variable to indicate when the game is paused
export let isPaused = false

function resumeGame() {
    isPaused = false
    pauseOverlay.classList.add('hidden')
}

// Function to apply pause state from server
export function setPaused(paused, meta = {}) {
    isPaused = !!paused
    
    // Import timer functions for pause/resume
    import('../ui/timer.js').then(({ pauseTimer, resumeTimer }) => {
        if (isPaused) {
            pauseOverlay.classList.remove('hidden')
            pauseMessage.textContent = meta.name ? `Game paused by ${meta.name}` : 'Paused'
            // Pause timer
            pauseTimer()
            // Play pause sound
            playSound('pause')
        } else {
            pauseOverlay.classList.add('hidden')
            // Resume timer
            resumeTimer()
            // Play resume sound
            playSound('resume')
        }
    })
}

function togglePause() {
    const newPaused = !isPaused
    
    // Emit to server for multiplayer sync
    if (socket) {
        socket.emit('game:pause', {
            paused: newPaused,
            ts: Date.now()
        })
    }
    
}

function quitGame() {
    //will be implemented in next step
    if (isPaused) resumeGame()
    socket.emit('game:quit')
    clearAllPlayers()
    resetPlayer()
    showMenuScreen()
    window.location.reload();

}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        e.preventDefault()
        togglePause()
    }
}

function handleResumeClick() {
    // Emit resume to server
    if (socket) {
        socket.emit('game:pause', {
            paused: false,
            ts: Date.now()
        })
    }
}

function handleQuitClick() {
    quitGame()
}

export function initializePauseMenu() {
    document.addEventListener('keydown', handleEscapeKey)
    resumeButton.addEventListener('click', handleResumeClick)
    quitButton.addEventListener('click', handleQuitClick)
    
    // Add pause button for mobile (ESC key not available)
    const pauseToggleButton = document.getElementById('pause-toggle')
    if (pauseToggleButton) {
        pauseToggleButton.addEventListener('click', () => {
            togglePause()
        })
    }
}