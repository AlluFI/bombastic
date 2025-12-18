
import { socket } from '../main.js'

//ui screen sections
const menuScreen = document.getElementById('menue-screen')
const gameScreen = document.getElementById('game-screen')
const endScreen = document.getElementById('end-screen')
const codeElement= document.getElementById('room-code')

//game control elements
const playerNameInput = document.getElementById('player-name')
const modeSelect = document.getElementById('mode')
const singlePlayerSection = document.getElementById('single-player-section')
const npcCountSelect = document.getElementById('npc-count')
const difficultySection = document.getElementById('difficulty-section')
const difficultySelect = document.getElementById('difficulty')
const startButton = document.getElementById('start-button')
const joinButton = document.getElementById('join-button')
const hostButton = document.getElementById('host-button')
const joinInput = document.getElementById('join-input')


// const startGameBtn = document.getElementById('start-game-button')

//player choices
export const playerData = {
    name: '',
    mode: 'multi', //multi player mode set to default
    difficulty: 'medium', //default difficulty
    npcCount: 2 //default number of NPCs for single-player
}




export function showMenuScreen() {
    menuScreen.classList.remove('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.add('hidden')
}

export function showGameScreen(roomCode) {
    menuScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    endScreen.classList.add('hidden')
    codeElement.textContent = `Room code: ${roomCode}`
}

export function showEndScreen() {
    menuScreen.classList.add('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.remove('hidden')
}

function handleStartGame() {
    console.log('start button clicked - starting single-player game')

    playerData.name = playerNameInput.value.trim()
    playerData.mode = modeSelect.value
    playerData.difficulty = difficultySelect.value
    playerData.npcCount = parseInt(npcCountSelect.value, 10)

    console.log('player data recorded', playerData)    

    // For single-player mode:
    // 1. First create a room (host)
    socket.emit('room:host', {
        name: playerData.name
    })
    
    // The rest will be handled in the 'room:created' event handler in main.js
}

function handleModeChange() {
    const selectedMode = modeSelect.value
    const isSinglePlayer = selectedMode === 'single'
    
    // Show/hide single-player specific UI
    singlePlayerSection.classList.toggle('hidden', !isSinglePlayer)
    startButton.classList.toggle('hidden', !isSinglePlayer)
    
    // Show/hide multiplayer specific UI
    joinButton.classList.toggle('hidden', isSinglePlayer)
    hostButton.classList.toggle('hidden', isSinglePlayer)
    joinInput.classList.toggle('hidden', isSinglePlayer)

    console.log('player mode changed to :' + selectedMode)
}

function handleDifficultyChange() {
    playerData.difficulty = difficultySelect.value
    console.log('difficulty changed to :' + difficultySelect.value)
}

function handleNPCCountChange() {
    playerData.npcCount = parseInt(npcCountSelect.value, 10)
    console.log('NPC count changed to :' + playerData.npcCount)
}

function handleHostGame() {

    playerData.name = playerNameInput.value.trim()
    socket.emit('room:host', {
        name: playerData.name
    })
}

function handleJoinGame() {

    playerData.name = playerNameInput.value.trim()
    const roomId = joinInput.value.trim()

    if (roomId) {
     socket.emit('room:join',{
        roomId: roomId,
        name: playerData.name,
 })
}
}

export function intializeMenu() {
    console.log('menue intialized')

    //start button is disabled by default 
    //input checks if the length of the input is 2 or more to enable start playing
    playerNameInput.addEventListener('input', () => {
    const name = playerNameInput.value.trim()
        startButton.disabled = name.length < 2
        hostButton.disabled = name.length < 2
    })

    //join button is disabled by default
    joinInput.addEventListener('input', () => {
        hostButton.disabled = joinInput.value
        joinButton.disabled = joinInput.value.trim() < 2
    })

    modeSelect.addEventListener('change', handleModeChange)
    difficultySelect.addEventListener('change', handleDifficultyChange)
    npcCountSelect.addEventListener('change', handleNPCCountChange)
    startButton.addEventListener('click', handleStartGame)
    hostButton.addEventListener('click', handleHostGame)
    joinButton.addEventListener('click', handleJoinGame)
    
    // Initialize mode change handler to set initial UI state
    handleModeChange()
}