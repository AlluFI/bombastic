import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, remotePlayers, clearAllPlayers } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu, playerData } from "./ui/menu.js";
import { isPaused, initializePauseMenu, setPaused } from "./ui/pause.js";
import { showGameScreen, showEndScreen, showMenuScreen } from "./ui/menu.js";
import { intializeTimer, startTimer, stopTimer } from "./ui/timer.js";
import { intializeScorboard, renderScoreboard, addPlayerToScoreboard, removePlayerFromScoreboard, updatePlayerStats } from "./ui/scoreboard.js";
import { placeRemoteBomb, clearPlayerBombs, handleServerBombExplosion } from "./game/bombController.js";
import { loadChatHistory, initializeChat } from "./ui/chat.js";
import { destroyBlockRemote, destroyBlocksRemote } from "./game/blockController.js"
import { initializeMap } from "./grid.js"
import { initializeLobby, showLobbyScreen, hideLobbyScreen, updateLobbyPlayers } from "./ui/lobby.js"
import { renderPowerup, removePowerup, checkPowerupPickup, clearAllPowerups, initializePlayerStats } from "./game/powerupController.js"
import { initializeSoundManager, playSound } from "./audio/soundManager.js"
import "./ui/audio-toggle.js"


const socket = io()
export { socket };

console.log('main.js loaded, initializing...')

intializeMenu()
initializePauseMenu()
intializeTimer()
intializeScorboard()
initializeChat(socket)
initializeLobby()
initializeSoundManager()

let player
let lastPosition = { x: 1, y: 1 }

export function resetPlayer() {
    player = null
    lastPosition = { x: 1, y: 1 }
}

// Socket event handlers
socket.on('connect', () => {
    console.log('✅ Socket connected with ID:', socket.id) 
})

socket.on('disconnect', () => {
    console.log('❌ Socket disconnected')
})

socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error)
    // Play connection error sound
    playSound('connectionError')
    // Show error toast
    import('./ui/notifications.js').then(({ showError }) => {
        showError('Failed to connect to server. Please check your connection.')
    })
    // Clear loading states
    import('./ui/menu.js').then(({ clearButtonLoading }) => {
        if (clearButtonLoading) {
            clearButtonLoading()
        }
    })
})

// Receive current game state (existing players)
socket.on('game:state', (state) => {
    // Initialize board from server if provided (authoritative source)
    // Only update map data, don't re-render (would clear player elements)
    if (state.board) {
        initializeMap(state.board, false) // false = don't force re-render
    }
    
    // Timer will be synced via timer:sync events from server
    // Don't start locally to avoid drift
    
    // Handle both old format (allPlayers) and new format (players)
    const players = state.allPlayers || state.players || []
    
    if (players.length > 0) {
        const myPlayer = players.find(p => p.id === socket.id)
        
        // Only create local player if it doesn't exist yet
        if (myPlayer && !player) {
            console.log('Creating player from game:state event:', myPlayer.id, myPlayer.name, `(${myPlayer.x}, ${myPlayer.y})`)
            player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)
            // Pass gameMode from server state if available
            showGameScreen(null, state.gameMode)
        } else if (!myPlayer) {
            console.warn('My player not found in game:state. Socket ID:', socket.id, 'Players:', players.map(p => p.id))
        }
        
        // Update/create remote players (including NPCs)
        // Don't update local player position from server - client controls it
        players.forEach(p => {
            if (p.id !== socket.id) {
                if (!remotePlayers.has(p.id)) {
                    createRemotePlayer(p)
                } else {
                    updateRemotePlayer(p.id, p.x, p.y)
                }
            }
        })
        
        // Update scoreboard
        renderScoreboard(players, socket.id)
    } else {
        console.warn('game:state received with no players')
    }
})

socket.on('room:created', (state) => {
    console.log('room:created received. Socket ID:', socket.id, 'Players in state:', state.players?.map(p => ({ id: p.id, name: p.name })))
    
    // Clear loading states
    import('./ui/menu.js').then(({ clearButtonLoading }) => {
        if (clearButtonLoading) {
            clearButtonLoading()
        }
    })
    
    // Initialize board from server if provided (authoritative source)
    // Only update map data once at the start, don't re-render (grid is already rendered)
    // Note: board comes in game:state, but we handle it there to avoid double-rendering
    // if (state.board) {
    //     initializeMap(state.board, true)
    // }
    
    const myPlayer = state.players?.find(p => p.id === socket.id)

    if (myPlayer) {
        console.log('Creating player from room:created:', myPlayer.id, myPlayer.name, `(${myPlayer.x}, ${myPlayer.y})`)
        player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)
        initializePlayerStats(player.id)
        console.log('Local player created:', player.id, player.name, `(${player.x}, ${player.y})`)
    } else {
        console.error('Could not find my player in room:created state. Available players:', state.players?.map(p => p.id))
    }

    state.players?.forEach(p => {
        if (p.id !== socket.id) {
            createRemotePlayer(p)
        }
    })

    // Check if this is single-player mode (starts immediately) or multiplayer (shows lobby)
    if (playerData.mode === 'single') {
        // Single-player: start game immediately
        showGameScreen(state.roomCode, state.gameMode)
        renderScoreboard(state.players, socket.id)
        loadChatHistory(state.chats)
        
        // Set game mode to single-player
        socket.emit('set-game-mode', {
            mode: 'single-player'
        })
        
        // Configure NPCs with individual difficulties
        socket.emit('configure-npcs', {
            count: playerData.npcCount,
            difficulties: playerData.difficulties
        })
        
        console.log(`Single-player game started with ${playerData.npcCount} NPC(s) at difficulties:`, playerData.difficulties)
    } else {
        // Multiplayer: show lobby screen (game hasn't started yet)
        const hostId = state.hostId || state.players?.[0]?.id
        showLobbyScreen(state.roomCode, state.players, hostId)
        renderScoreboard(state.players, socket.id)
        loadChatHistory(state.chats || [])
    }
})

socket.on('room:updated', (state) => {
    console.log("Room updated:", state.players);
    
    // Clear loading states (if any menu buttons were in loading state)
    import('./ui/menu.js').then(({ clearButtonLoading }) => {
        if (clearButtonLoading) {
            clearButtonLoading()
        }
    })
    
    // Check if game is running or still in lobby
    const isGameRunning = state.isRunning !== false // Default to true if not specified (for backward compatibility)
    
    if (!isGameRunning && state.gameMode !== 'single-player') {
        // Still in lobby - show/update lobby screen
        const hostId = state.hostId || state.players?.[0]?.id
        
        // Show lobby screen if not already shown (for players joining)
        const lobbyScreen = document.getElementById('lobby-screen')
        if (lobbyScreen && lobbyScreen.classList.contains('hidden')) {
            showLobbyScreen(state.roomCode, state.players, hostId)
        } else {
            updateLobbyPlayers(state.players, hostId)
        }
        
        renderScoreboard(state.players, socket.id)
        
        // Only create local player if it doesn't exist yet
        if (!player) {
            const myPlayer = state.players.find(p => p.id === socket.id)
            if (myPlayer) {
                player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color, myPlayer)
            }
        }
        
        // Create/update remote players that don't already exist
        state.players.forEach(p => {
            if (p.id !== socket.id && !remotePlayers.has(p.id)) {
                createRemotePlayer(p)
            }
        })
        
        return // Stay in lobby, don't show game screen
    }
    
    // Game is running - show game screen
    // Only create local player if it doesn't exist yet
    if (!player) {
        const myPlayer = state.players.find(p => p.id === socket.id)
        if (myPlayer) {
            player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color, myPlayer)
            initializePlayerStats(player.id)
            showGameScreen(state.roomCode, state.gameMode)
            renderScoreboard(state.players, socket.id)
            loadChatHistory(state.chats || [])
        }
    }

    // Create/update all players (including NPCs) that don't already exist
    state.players.forEach(p => {
        if (p.id !== socket.id && !remotePlayers.has(p.id)) {
            // Create remote player (works for both human players and NPCs)
            createRemotePlayer(p)
        }
    })
    
    // Always update scoreboard to reflect current state (including NPCs)
    renderScoreboard(state.players, socket.id)
})

// Handle NPC configuration confirmation
socket.on('npcs-configured', (data) => {
    console.log(`NPCs configured: ${data.count} NPC(s)`, data.npcs)
    // Timer will be synced via timer:sync events from server
    // Request room update to get NPCs in the players list
    // The server will emit room:updated with NPCs included
})

// Handle game mode change confirmation
socket.on('game-mode-changed', (data) => {
    console.log(`Game mode changed to: ${data.mode}`)
})

// Handle game started (transition from lobby to game)
socket.on('game:started', (data) => {
    console.log('Game started!', data)
    
    // Play game start sound
    playSound('gameStart')
    
    // Hide lobby screen
    hideLobbyScreen()
    
    // Initialize board if provided
    if (data.board) {
        initializeMap(data.board, true)
    }
    
    // Initialize player stats for all players
    if (data.players) {
        data.players.forEach(p => {
            initializePlayerStats(p.id)
        })
    }
    
    // Render existing power-ups if any
    if (data.powerups && Array.isArray(data.powerups)) {
        data.powerups.forEach(powerup => {
            renderPowerup(powerup)
        })
    }
    
    // Show game screen
    showGameScreen(data.roomCode, data.gameMode)
    
    // Start timer with server synchronization
    if (data.gameStartTime) {
        // Sync timer with server time
        const now = Date.now()
        const elapsedSeconds = Math.floor((now - data.gameStartTime) / 1000)
        import('./ui/timer.js').then(({ syncTimer }) => {
            syncTimer(elapsedSeconds)
        })
    } else {
        // Fallback: start timer locally if server time not provided
        import('./ui/timer.js').then(({ startTimer }) => {
            startTimer()
        })
    }
    
    // Update scoreboard
    if (data.players) {
        renderScoreboard(data.players, socket.id)
    }
    
    // Load chat history
    if (data.chats) {
        loadChatHistory(data.chats)
    }
})

// Handle timer synchronization from server
socket.on('timer:sync', (data) => {
    import('./ui/timer.js').then(({ syncTimer }) => {
        syncTimer(data.elapsedSeconds)
    })
})

// Handle game end (winner detection)
socket.on('game:end', (data) => {
    console.log('Game ended:', data)
    
    // Stop the timer
    stopTimer()
    
    // Play game end sound
    playSound('gameEnd')
    
    // Check if local player won
    if (data.winner && data.winner.id === socket.id) {
        playSound('winner')
    }
    
    // Show end screen first
    showEndScreen()
    
    // Render enhanced endgame screen with winner and final scores
    import('./ui/endgame.js').then(({ renderEndScreen }) => {
        renderEndScreen(data, socket.id)
    })
    
    // Reset player state for next game
    resetPlayer()
    clearAllPlayers()
    clearAllPowerups()
})

socket.on('error', (data) => {
    // Use toast notification instead of alert
    import('./ui/notifications.js').then(({ showError }) => {
        showError(data.message)
    })
    
    // Clear loading states on error
    import('./ui/menu.js').then(({ clearButtonLoading }) => {
        if (clearButtonLoading) {
            clearButtonLoading()
        }
    })
})

// New player joined
socket.on('player:joined', (playerData) => {
    console.log('Player joined:', playerData.name)
    createRemotePlayer(playerData)

    addPlayerToScoreboard(playerData)
    
    // Play join sound
    playSound('playerJoin')
})

// Other player moved
socket.on('player:moved', (moveData) => {
    updateRemotePlayer(moveData.id, moveData.x, moveData.y)
})

// Player left
socket.on('player:left', (playerId) => {
    console.log('Player left:', playerId)
    removeRemotePlayer(playerId)

    removePlayerFromScoreboard(playerId)

    clearPlayerBombs(playerId)
    
    // Play leave sound
    playSound('playerLeave')
})

// Game pause/resume broadcast from server
socket.on('game:pause', (payload) => {
    setPaused(payload.paused, payload)

    if(payload.paused) {
        stopTimer()
    } else {
        startTimer()
    }
})

socket.on('bomb:placed', (bombData) => {
    console.log('Bomb placed by another player:', bombData)
    placeRemoteBomb(bombData)
})

// Server-authoritative bomb explosion (enables visible chain reactions)
socket.on('bomb:exploded', (bombData) => {
    console.log('Bomb exploded (server):', bombData)
    handleServerBombExplosion(bombData)
})

socket.on('block:destroyed', (data) => {
    console.log('Block destroyed by server:', data)
    destroyBlockRemote(data.x, data.y)
})


socket.on('blocks:destroyed', (data) => {
    console.log(`${data.blocks.length} blocks destroyed by server`)
    destroyBlocksRemote(data.blocks)
})

socket.on('powerup:spawned', (data) => {
    console.log(`${data.powerups.length} power-up(s) spawned`)
    data.powerups.forEach(powerup => {
        renderPowerup(powerup)
    })
})

socket.on('powerup:picked', (data) => {
    console.log(`Power-up picked up by player ${data.playerId} at (${data.x}, ${data.y})`)
    removePowerup(data.powerupId, data.x, data.y)
    
    // If local player picked it up, update their stats (already applied locally in checkPowerupPickup)
    // The server has already updated the player's bombRange, so we just need to sync
    if (data.playerId === socket.id) {
        // Stats already updated locally when pickup was detected
        console.log(`Local player ${data.playerId} picked up ${data.type} power-up`)
    }
})

socket.on('powerup:granted', (data) => {
    console.log(`Power-up granted to player ${data.playerId}: ${data.type}`)
    
    // Apply power-up to the player
    import('./game/powerupController.js').then(({ addPowerupToPlayer }) => {
        addPowerupToPlayer(data.playerId, data.type)
        
        // Play sound if local player received it
        if (data.playerId === socket.id) {
            playSound('powerupPickup')
        }
    })
})

socket.on('powerup:expired', (data) => {
    console.log(`Power-up expired for player ${data.playerId}: ${data.type}`)
    
    // Expiration is automatically handled in isPlayerImmortal when checked
    // Just trigger a check to update the visual
    import('./game/powerupController.js').then(({ isPlayerImmortal }) => {
        // Force check to update visual (will auto-expire and remove visual)
        isPlayerImmortal(data.playerId)
    })
})

socket.on('player:damaged', (data) => {
    console.log(`Player ${data.playerId} was damaged. Lives: ${data.lives}`)
    
    // Update scoreboard for all players (local and remote)
    updatePlayerStats(data.playerId, { 
        lives: data.lives,
        alive: !data.died // Set alive based on died flag
    })
    
    // Don't update local player from this event - they already updated themselves
    if (data.playerId === socket.id) {
        console.log('Ignoring damage event for local player (already applied)')
        return
    }
    
    // Update remote player if it exists
    const remotePlayer = remotePlayers.get(data.playerId)
    if (remotePlayer) {
        remotePlayer.lives = data.lives
        
        if (data.died) {
            remotePlayer.die()
            // Play death sound for remote player
            playSound('playerDeath')
        } else {
            // Start invincibility animation for remote player
            remotePlayer.startInvincibility(2000)
            // Play hit sound for remote player
            playSound('playerHit')
        }
    }
})


let lastFrameTime = performance.now();
let frames = 0;
let fps = 0;

function updateFPS() {
    const now = performance.now();
    frames++;
    if (now - lastFrameTime >= 1000) {
        fps = frames;
        frames = 0;
        lastFrameTime = now;
        const fpsValue = document.getElementById('fps-value');
        if (fpsValue) fpsValue.textContent = fps;
    }
}

function gameLoop() {
    updateFPS()
    if (!player) {
        // Debug: log occasionally if player is missing
        if (Math.random() < 0.01) { // 1% chance
            console.warn('Game loop running but player is null. Socket ID:', socket.id)
        }
        requestAnimationFrame(gameLoop)
        return
    }
    if (!isPaused) {
        updatePlayerMovement(player)
        
        // Check for power-up pickup
        checkPowerupPickup(player)
        
        updatePlayerRender(player)
        
        // Also update all remote players' rendering
        remotePlayers.forEach(remotePlayer => {
            updatePlayerRender(remotePlayer)
        })
    } else {
        // Game is paused - still render players but don't update movement
        updatePlayerRender(player)
        remotePlayers.forEach(remotePlayer => {
            updatePlayerRender(remotePlayer)
        })
    }
    
    // Check and clear expired invincibility for all players
    const now = Date.now()
    if (player && player.invincible && now >= player.invincibilityEnd) {
        player.invincible = false
        if (player.element && player.alive) {
            player.element.style.animation = ''
            player.element.style.opacity = '1'
            player.element.style.filter = ''
        }
    }
    remotePlayers.forEach(remotePlayer => {
        if (remotePlayer.invincible && now >= remotePlayer.invincibilityEnd) {
            remotePlayer.invincible = false
            if (remotePlayer.element && remotePlayer.alive) {
                remotePlayer.element.style.animation = ''
                remotePlayer.element.style.opacity = '1'
                remotePlayer.element.style.filter = ''
            }
        }
    })
    
    // Send position to server if changed
    if (player.x !== lastPosition.x || player.y !== lastPosition.y) {
        socket.emit('player:move', {
            x: player.x,
            y: player.y
        })
        lastPosition = { x: player.x, y: player.y }
    }
    
    requestAnimationFrame(gameLoop)
}
gameLoop()