
import { socket } from '../main.js'
import { clearAllPlayers } from '../player.js'
import { initializeLobbyBrowser } from './lobbyBrowser.js'
import { playSound } from '../audio/soundManager.js'

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
const npcDifficultiesSection = document.getElementById('npc-difficulties-section')
const npcDifficultyList = document.getElementById('npc-difficulty-list')
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
    difficulties: ['medium', 'medium'], //default difficulties for each NPC
    npcCount: 2 //default number of NPCs for single-player
}




export function showMenuScreen() {
    menuScreen.classList.remove('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.add('hidden')
    
    // Play menu open sound
    playSound('menuOpen', { volume: 0.5 })
    
    // Show chat when returning to menu (for multiplayer)
    import('./chat.js').then(({ setChatVisibility }) => {
        setChatVisibility(true)
    })
}

export function showGameScreen(roomCode, gameMode = null) {
    menuScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    endScreen.classList.add('hidden')
    
    if (roomCode) {
        codeElement.textContent = `Room code: ${roomCode}`
    }
    
    // Hide chat in single-player mode, show in multiplayer
    // Check both playerData.mode (client-side) and gameMode (server-side)
    import('./chat.js').then(({ setChatVisibility }) => {
        const isSinglePlayer = gameMode === 'single-player' || playerData.mode === 'single'
        setChatVisibility(!isSinglePlayer)
    })
}

export function showEndScreen() {
    menuScreen.classList.add('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.remove('hidden')
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading')
        button.disabled = true
    } else {
        button.classList.remove('loading')
        button.disabled = false
    }
}

export function clearButtonLoading() {
    // Clear loading state from all menu buttons
    setButtonLoading(startButton, false)
    setButtonLoading(hostButton, false)
    setButtonLoading(joinButton, false)
}

function handleStartGame() {
    playerData.name = playerNameSingleInput.value.trim()
    playerData.mode = modeSelect.value
    playerData.npcCount = parseInt(npcCountSelect.value, 10)
    
    // Collect individual difficulties from selectors
    playerData.difficulties = []
    for (let i = 0; i < playerData.npcCount; i++) {
        const select = document.getElementById(`npc-difficulty-${i}`)
        if (select) {
            playerData.difficulties.push(select.value)
        } else {
            playerData.difficulties.push('medium') // fallback
        }
    }

    // Set loading state
    setButtonLoading(startButton, true)

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

}

function updateNPCDifficultySelectors() {
    const count = parseInt(npcCountSelect.value, 10)
    playerData.npcCount = count
    
    // Ensure difficulties array matches count
    while (playerData.difficulties.length < count) {
        playerData.difficulties.push('medium')
    }
    playerData.difficulties = playerData.difficulties.slice(0, count)
    
    // Clear existing selectors
    npcDifficultyList.innerHTML = ''
    
    // Create a difficulty selector for each NPC
    for (let i = 0; i < count; i++) {
        const container = document.createElement('div')
        container.className = 'npc-difficulty-item'
        container.style.marginBottom = '10px'
        
        const label = document.createElement('label')
        label.textContent = `Bot ${i + 1} Difficulty:`
        label.style.display = 'block'
        label.style.marginBottom = '5px'
        label.style.color = '#00bfff'
        
        const select = document.createElement('select')
        select.id = `npc-difficulty-${i}`
        select.style.width = '100%'
        select.style.padding = '8px'
        select.style.fontSize = '16px'
        select.style.backgroundColor = 'rgba(0, 119, 182, 0.2)'
        select.style.color = '#00bfff'
        select.style.border = '2px solid #0077b6'
        select.style.borderRadius = '4px'
        
        const options = [
            { value: 'easy', text: 'Easy' },
            { value: 'medium', text: 'Medium' },
            { value: 'hard', text: 'Hard' }
        ]
        
        options.forEach(opt => {
            const option = document.createElement('option')
            option.value = opt.value
            option.textContent = opt.text
            if (opt.value === playerData.difficulties[i]) {
                option.selected = true
            }
            select.appendChild(option)
        })
        
        // Update playerData when selector changes
        select.addEventListener('change', () => {
            playerData.difficulties[i] = select.value
        })
        
        container.appendChild(label)
        container.appendChild(select)
        npcDifficultyList.appendChild(container)
    }
}

function handleNPCCountChange() {
    updateNPCDifficultySelectors()
}

function handleHostGame() {
    playerData.name = playerNameInput.value.trim()
    
    // Set loading state
    setButtonLoading(hostButton, true)
    
    socket.emit('room:host', {
        name: playerData.name
    })
}

function handleJoinGame() {
    playerData.name = playerNameJoinInput.value.trim()
    const roomId = joinInput.value.trim()

    if (roomId) {
        // Set loading state
        setButtonLoading(joinButton, true)
        
        socket.emit('room:join', {
            roomId: roomId,
            name: playerData.name,
        })
    }
}

function handleRestartGame() {
    console.log('Restart button clicked - returning to menu')

    window.location.reload()
    
    // Clear all players from the game
    clearAllPlayers()
    
    // Reset player data
    playerData.name = ''
    playerData.mode = 'multi'
    playerData.difficulties = ['medium', 'medium']
    playerData.npcCount = 2
    
    // Reset UI inputs
    playerNameInput.value = ''
    playerNameJoinInput.value = ''
    playerNameSingleInput.value = ''
    joinInput.value = ''
    modeSelect.value = 'multi'
    npcCountSelect.value = '2'
    
    // Reset NPC difficulty selectors
    updateNPCDifficultySelectors()
    
    // Reset mode UI
    handleModeChange()
    
    // Show menu screen
    showMenuScreen()
    
    // Reset game state (will be handled by main.js resetPlayer)
    // The socket connection remains, but game state is reset
}

export function initializeMenu() {
    // Initialize lobby browser
    initializeLobbyBrowser()

    //Mode toggle buttons
    multiModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
        modeSelect.value = 'multi'
        handleModeChange()
    })

    singleModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
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
    npcCountSelect.addEventListener('change', handleNPCCountChange)
    
    // Initialize NPC difficulty selectors on page load
    updateNPCDifficultySelectors()
    startButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleStartGame()
    })
    hostButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleHostGame()
    })
    joinButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleJoinGame()
    })
    restartButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleRestartGame()
    })
    
    // Initialize mode change handler to set initial UI state
    handleModeChange()
    
    // Initialize button states
    startButton.disabled = playerNameSingleInput.value.trim().length < 2
}