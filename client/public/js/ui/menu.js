
import { socket } from '../main.js'
import { clearAllPlayers } from '../player.js'

//ui screen sections
const menuScreen = document.getElementById('menue-screen')
const gameScreen = document.getElementById('game-screen')
const endScreen = document.getElementById('end-screen')
const codeElement= document.getElementById('room-code')

//game control elements
const playerNameInput = document.getElementById('player-name')
const playerNameJoinInput = document.getElementById('player-name-join')
const playerNameSingleInput = document.getElementById('player-name-single')
const modeSelect = document.getElementById('mode')
const multiModeBtn = document.getElementById('multi-mode-btn')
const singleModeBtn = document.getElementById('single-mode-btn')
const multiPlayerSection = document.getElementById('multi-player-section')
const singlePlayerSection = document.getElementById('single-player-section')
const npcCountSelect = document.getElementById('npc-count')
const difficultySection = document.getElementById('difficulty-section')
const difficultySelect = document.getElementById('difficulty')
const startButton = document.getElementById('start-button')
const joinButton = document.getElementById('join-button')
const hostButton = document.getElementById('host-button')
const joinInput = document.getElementById('join-input')
const restartButton = document.getElementById('restart-button')


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
    console.log('🎮 Start button clicked - starting single-player game')

    playerData.name = playerNameSingleInput.value.trim()
    playerData.mode = modeSelect.value
    playerData.difficulty = difficultySelect.value
    playerData.npcCount = parseInt(npcCountSelect.value, 10)

    console.log('📝 Player data recorded:', playerData)    
    console.log('📡 Emitting room:host event with name:', playerData.name)

    // For single-player mode:
    // 1. First create a room (host)
    socket.emit('room:host', {
        name: playerData.name
    })
    
    console.log('✅ room:host event emitted, waiting for room:created...')
    // The rest will be handled in the 'room:created' event handler in main.js
}

function handleModeChange() {
    const selectedMode = modeSelect.value
    const isSinglePlayer = selectedMode === 'single'
    
    // Update button styles
    if (isSinglePlayer) {
        singleModeBtn.classList.add('active')
        multiModeBtn.classList.remove('active')
    } else {
        multiModeBtn.classList.add('active')
        singleModeBtn.classList.remove('active')
    }
    
    // Show/hide single-player specific UI
    singlePlayerSection.classList.toggle('hidden', !isSinglePlayer)
    
    // Show/hide multiplayer specific UI
    multiPlayerSection.classList.toggle('hidden', isSinglePlayer)

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

    playerData.name = playerNameJoinInput.value.trim()
    const roomId = joinInput.value.trim()

    if (roomId) {
     socket.emit('room:join',{
        roomId: roomId,
        name: playerData.name,
 })
}
}

function handleRestartGame() {
    console.log('Restart button clicked - returning to menu')
    
    // Clear all players from the game
    clearAllPlayers()
    
    // Reset player data
    playerData.name = ''
    playerData.mode = 'multi'
    playerData.difficulty = 'medium'
    playerData.npcCount = 2
    
    // Reset UI inputs
    playerNameInput.value = ''
    playerNameJoinInput.value = ''
    playerNameSingleInput.value = ''
    joinInput.value = ''
    modeSelect.value = 'multi'
    difficultySelect.value = 'medium'
    npcCountSelect.value = '2'
    
    // Reset mode UI
    handleModeChange()
    
    // Show menu screen
    showMenuScreen()
    
    // Reset game state (will be handled by main.js resetPlayer)
    // The socket connection remains, but game state is reset
}

export function intializeMenu() {
    console.log('menue intialized')

    //Mode toggle buttons
    multiModeBtn.addEventListener('click', () => {
        modeSelect.value = 'multi'
        handleModeChange()
    })

    singleModeBtn.addEventListener('click', () => {
        modeSelect.value = 'single'
        handleModeChange()
    })

    //Host button - enable when player name has 2+ characters
    playerNameInput.addEventListener('input', () => {
        const name = playerNameInput.value.trim()
        hostButton.disabled = name.length < 2
    })

    //Start button - enable when single-player name has 2+ characters
    playerNameSingleInput.addEventListener('input', () => {
        const name = playerNameSingleInput.value.trim()
        startButton.disabled = name.length < 2
    })

    //Join button - enable when both room code and name are valid
    const checkJoinButton = () => {
        const name = playerNameJoinInput.value.trim()
        const roomId = joinInput.value.trim()
        joinButton.disabled = name.length < 2 || roomId.length < 2
    }

    playerNameJoinInput.addEventListener('input', checkJoinButton)
    joinInput.addEventListener('input', checkJoinButton)

    modeSelect.addEventListener('change', handleModeChange)
    difficultySelect.addEventListener('change', handleDifficultyChange)
    npcCountSelect.addEventListener('change', handleNPCCountChange)
    startButton.addEventListener('click', handleStartGame)
    hostButton.addEventListener('click', handleHostGame)
    joinButton.addEventListener('click', handleJoinGame)
    restartButton.addEventListener('click', handleRestartGame)
    
    // Initialize mode change handler to set initial UI state
    handleModeChange()
    
    // Initialize button states
    startButton.disabled = playerNameSingleInput.value.trim().length < 2
}