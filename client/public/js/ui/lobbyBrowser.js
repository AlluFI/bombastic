import { socket } from '../main.js'
import { playerData } from './menu.js'

// UI elements
const lobbyList = document.getElementById('lobby-list')
const noLobbiesMessage = document.getElementById('no-lobbies-message')

let activeLobbies = new Map() // roomCode -> { roomCode, playerCount, maxPlayers }

export function initializeLobbyBrowser() {
    
    // Request lobby list when menu is shown
    socket.on('connect', () => {
        requestLobbyList()
    })
    
    // Listen for lobby updates
    socket.on('lobby:list', (lobbies) => {
        updateLobbyList(lobbies)
    })
    
    // Listen for lobby updates (when lobbies are created/updated/removed)
    socket.on('lobby:updated', (data) => {
        // Update lobby list directly if data is provided, otherwise request
        if (data && data.lobbies) {
            updateLobbyList(data.lobbies)
        } else {
            requestLobbyList()
        }
    })
    
    // Request lobby list periodically (every 5 seconds)
    setInterval(() => {
        requestLobbyList()
    }, 5000)
    
    // Initial request
    requestLobbyList()
}

function requestLobbyList() {
    socket.emit('lobby:list-request')
}

function updateLobbyList(lobbies) {
    if (!lobbyList) return
    
    activeLobbies.clear()
    
    // Update active lobbies map
    if (lobbies && Array.isArray(lobbies)) {
        lobbies.forEach(lobby => {
            activeLobbies.set(lobby.roomCode, lobby)
        })
    }
    
    // Clear existing list
    lobbyList.innerHTML = ''
    
    if (activeLobbies.size === 0) {
        if (noLobbiesMessage) {
            noLobbiesMessage.style.display = 'block'
        }
        return
    }
    
    if (noLobbiesMessage) {
        noLobbiesMessage.style.display = 'none'
    }
    
    // Render each lobby
    activeLobbies.forEach((lobby, roomCode) => {
        const lobbyElement = createLobbyElement(lobby)
        lobbyList.appendChild(lobbyElement)
    })
}

function createLobbyElement(lobby) {
    const element = document.createElement('div')
    element.className = 'lobby-browser-entry'
    element.dataset.roomCode = lobby.roomCode
    
    const playerCount = lobby.playerCount || 0
    const maxPlayers = lobby.maxPlayers || 4
    
    element.innerHTML = `
        <div class="lobby-entry-code">${lobby.roomCode}</div>
        <div class="lobby-entry-players">${playerCount}/${maxPlayers} players</div>
    `
    
    // Make clickable to join
    element.addEventListener('click', () => {
        joinLobby(lobby.roomCode)
    })
    
    return element
}

function joinLobby(roomCode) {
    const playerName = document.getElementById('player-name-join')?.value.trim()
    
    if (!playerName || playerName.length < 2) {
        // Focus on name input if empty
        const nameInput = document.getElementById('player-name-join')
        if (nameInput) {
            nameInput.focus()
            alert('Please enter your name first')
        }
        return
    }
    
    // Fill in the join input and trigger join
    const joinInput = document.getElementById('join-input')
    if (joinInput) {
        joinInput.value = roomCode
    }
    
    // Set player name if not already set
    if (playerName) {
        playerData.name = playerName
    }
    
    // Emit join event
    socket.emit('room:join', {
        roomId: roomCode,
        name: playerName
    })
}

