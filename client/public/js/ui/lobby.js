import { socket } from '../main.js'
import { showMenuScreen } from './menu.js'
import { playSound } from '../audio/soundManager.js'

// UI elements
const lobbyScreen = document.getElementById('lobby-screen')
const lobbyCodeDisplay = document.getElementById('lobby-code-display')
const lobbyPlayersList = document.getElementById('lobby-players-list')
const lobbyPlayerCount = document.getElementById('lobby-player-count')
const startGameButton = document.getElementById('start-game-button')
const startGameHint = document.getElementById('start-game-hint')
const leaveLobbyButton = document.getElementById('leave-lobby-button')

let isHost = false
let currentRoomCode = null
let currentPlayers = []

export function showLobbyScreen(roomCode, players, hostId) {
    currentRoomCode = roomCode
    currentPlayers = (players || []).map(p => ({
        ...p,
        isHost: p.id === hostId || p.isHost
    }))
    isHost = socket.id === hostId
    
    // Hide other screens
    document.getElementById('menue-screen').classList.add('hidden')
    document.getElementById('game-screen').classList.add('hidden')
    document.getElementById('end-screen').classList.add('hidden')
    
    // Show lobby screen
    lobbyScreen.classList.remove('hidden')
    
    // Update UI
    updateLobbyCode(roomCode)
    updatePlayersList(currentPlayers)
    updateStartButton()
}

export function hideLobbyScreen() {
    lobbyScreen.classList.add('hidden')
    currentRoomCode = null
    currentPlayers = []
    isHost = false
}

export function returnToLobby() {
    // Hide end screen and game screen
    document.getElementById('end-screen').classList.add('hidden')
    document.getElementById('game-screen').classList.add('hidden')
    document.getElementById('menue-screen').classList.add('hidden')
    
    // Show lobby screen with current room state
    lobbyScreen.classList.remove('hidden')
    
    // Request updated room state from server
    socket.emit('room:state-request')
}

export function updateLobbyPlayers(players, hostId) {
    currentPlayers = (players || []).map(p => ({
        ...p,
        isHost: p.id === hostId || p.isHost
    }))
    isHost = socket.id === hostId
    updatePlayersList(currentPlayers)
    updateStartButton()
}

function updateLobbyCode(roomCode) {
    if (lobbyCodeDisplay) {
        lobbyCodeDisplay.textContent = roomCode
        lobbyCodeDisplay.style.fontSize = '2em'
        lobbyCodeDisplay.style.fontWeight = 'bold'
        lobbyCodeDisplay.style.letterSpacing = '0.2em'
        lobbyCodeDisplay.style.padding = '10px 20px'
        lobbyCodeDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
        lobbyCodeDisplay.style.borderRadius = '8px'
        lobbyCodeDisplay.style.display = 'inline-block'
    }
}

function updatePlayersList(players) {
    if (!lobbyPlayersList) return
    
    lobbyPlayersList.innerHTML = ''
    
    if (players.length === 0) {
        lobbyPlayersList.innerHTML = '<p class="lobby-empty">No players yet</p>'
        return
    }
    
    players.forEach((player, index) => {
        const playerElement = document.createElement('div')
        playerElement.className = 'lobby-player-entry'
        
        const isLocalPlayer = player.id === socket.id
        const isHostPlayer = player.id === (currentPlayers.find(p => p.isHost)?.id || null)
        
        playerElement.innerHTML = `
            <span class="lobby-player-color" style="background-color: ${player.color}"></span>
            <span class="lobby-player-name">${player.name}${isLocalPlayer ? ' (You)' : ''}</span>
            ${isHostPlayer ? '<span class="lobby-host-badge">Host</span>' : ''}
        `
        
        lobbyPlayersList.appendChild(playerElement)
    })
    
    // Update player count
    if (lobbyPlayerCount) {
        lobbyPlayerCount.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} in lobby`
    }
}

function updateStartButton() {
    if (!startGameButton) return
    
    const canStart = isHost && currentPlayers.length >= 2
    
    startGameButton.disabled = !canStart
    
    if (isHost) {
        startGameButton.style.display = 'block'
        if (startGameHint) {
            if (currentPlayers.length < 2) {
                startGameHint.textContent = `Need at least 2 players to start (${currentPlayers.length}/2)`
                startGameHint.style.display = 'block'
            } else {
                startGameHint.textContent = 'Ready to start!'
                startGameHint.style.display = 'block'
            }
        }
    } else {
        startGameButton.style.display = 'none'
        if (startGameHint) {
            startGameHint.textContent = 'Waiting for host to start the game...'
            startGameHint.style.display = 'block'
        }
    }
}

function handleStartGame() {
    if (!isHost) {
        return
    }
    
    if (currentPlayers.length < 2) {
        alert('Need at least 2 players to start the game')
        return
    }
    
    // Play button click sound
    playSound('buttonClick') 
    socket.emit('game:start', {
        roomCode: currentRoomCode
    })
}

function handleLeaveLobby() {
    // Play button click sound
    playSound('buttonClick')
    
    // Emit leave event
    socket.emit('lobby:leave')
    
    // Reload page to ensure fresh state (especially for grid rendering)
    window.location.reload()
}

export function initializeLobby() {
    
    if (startGameButton) {
        startGameButton.addEventListener('click', handleStartGame)
    }
    
    if (leaveLobbyButton) {
        leaveLobbyButton.addEventListener('click', handleLeaveLobby)
    }
}

