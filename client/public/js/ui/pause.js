import { showMenuScreen } from "./menu.js"

const pauseOverlay = document.getElementById('pause-overlay')
const resumeButton = document.getElementById('resume-id')
const quitButton = document.getElementById('quit-button')

//global variable to indicate when the game is paused
export let isPaused = false

function pauseGame() {
    isPaused = true
    pauseOverlay.classList.remove('hidden')
    console.log('game paused')
}

function resumeGame() {
    isPaused = false
    pauseOverlay.classList.add('hidden')
    console.log('game resumed')
}

function togglePause() {
    isPaused ? resumeGame() : pauseGame()
}

function quitGame() {
    //will be implemented in next step
    if (isPaused) resumeGame()
    showMenuScreen()
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        e.preventDefault()
        togglePause()
    }
}

function handleResumeClick() {
    resumeGame()
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