import { showMenuScreen } from "./menu.js"
import {socket} from "../main.js"

const pauseOverlay = document.getElementById('pause-overlay')
const resumeButton = document.getElementById('resume-id')
const quitButton = document.getElementById('quit-button')

//global variable to indicate when the game is paused
export let isPaused = false

function resumeGame() {
    isPaused = false
    pauseOverlay.classList.add('hidden')
    console.log('game resumed')
}

// Function to apply pause state from server
export function setPaused(paused, meta = {}) {
    isPaused = !!paused
    if (isPaused) {
        pauseOverlay.classList.remove('hidden')
        console.log('Game paused', meta.by ? `by ${meta.by}` : '')
    } else {
        pauseOverlay.classList.add('hidden')
        console.log('Game resumed')
    }
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
    showMenuScreen()
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
    console.log('pause menu initialized')
    document.addEventListener('keydown', handleEscapeKey)
    resumeButton.addEventListener('click', handleResumeClick)
    quitButton.addEventListener('click', handleQuitClick)
}