import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, remotePlayers, clearAllPlayers } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { initializeMenu, playerData } from "./ui/menu.js";
import { isPaused, initializePauseMenu, setPaused } from "./ui/pause.js";
import { showGameScreen, showEndScreen, showMenuScreen } from "./ui/menu.js";
import { initializeTimer, startTimer, stopTimer } from "./ui/timer.js";
import { initializeScoreboard, renderScoreboard, addPlayerToScoreboard, removePlayerFromScoreboard, updatePlayerStats } from "./ui/scoreboard.js";
import { placeRemoteBomb, clearPlayerBombs, clearAllBombs, handleServerBombExplosion, pendingConfirmations } from "./game/bombController.js";
import { loadChatHistory, initializeChat } from "./ui/chat.js";
import { destroyBlockRemote, destroyBlocksRemote, clearDestroyedBlocks } from "./game/blockController.js"
import { initializeMap } from "./grid.js"
import { initializeLobby, showLobbyScreen, hideLobbyScreen, updateLobbyPlayers } from "./ui/lobby.js"
import { renderPowerup, removePowerup, checkPowerupPickup, clearAllPowerups, initializePlayerStats, addPowerupToPlayer } from "./game/powerupController.js"
import { initializeSoundManager, playSound } from "./audio/soundManager.js"
import "./ui/audio-toggle.js"


const socket = io({
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
})
export { socket };

initializeMenu()
initializePauseMenu()
initializeTimer()
initializeScoreboard()
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
    // Socket connected
})

socket.on('disconnect', () => {
    // Socket disconnected
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
                    // Only render scoreboard when a new player is added
                    renderScoreboard(players, socket.id)
                } else {
                    updateRemotePlayer(p.id, p.x, p.y)
                }
            }
        })
    }
})

socket.on('room:created', (state) => {
    
    // Clear loading states
    import('./ui/menu.js').then(({ clearButtonLoading }) => {
        if (clearButtonLoading) {
            clearButtonLoading()
        }
    })
    
   
    const myPlayer = state.players?.find(p => p.id === socket.id)

    if (myPlayer) {
        player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)
        initializePlayerStats(player.id)
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
        
    } else {
        // Multiplayer: show lobby screen (game hasn't started yet)
        const hostId = state.hostId || state.players?.[0]?.id
        showLobbyScreen(state.roomCode, state.players, hostId)
        renderScoreboard(state.players, socket.id)
        loadChatHistory(state.chats || [])
    }
})

socket.on('room:updated', (state) => {
    
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
    // Timer will be synced via timer:sync events from server
    // Request room update to get NPCs in the players list
    // The server will emit room:updated with NPCs included
})

// Handle game mode change confirmation
socket.on('game-mode-changed', (data) => {
    // Game mode changed
})

// Handle game started (transition from lobby to game)
socket.on('game:started', (data) => {
    
    // Play game start sound
    playSound('gameStart')
    
    // Clear previous game state
    clearAllPlayers()
    clearAllPowerups()
    clearAllBombs()
    clearDestroyedBlocks()  // Clear block destruction tracking
    resetPlayer()
    
    // Hide lobby screen
    hideLobbyScreen()
    
    // Show game screen FIRST so grid element is accessible
    showGameScreen(data.roomCode, data.gameMode)
    
    // Initialize board if provided
    if (data.board) {
        initializeMap(data.board, true)
    }
    
    // Create/update all players (must happen after grid is rendered and screen is visible)
    // Use double requestAnimationFrame to ensure grid is fully rendered and visible
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (data.players && data.players.length > 0) {
                // Create local player if it doesn't exist
                const myPlayer = data.players.find(p => p.id === socket.id)
                if (myPlayer && !player) {
                    player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color, myPlayer)
                }
                
                // Create/update remote players (including NPCs)
                data.players.forEach(p => {
                    if (p.id !== socket.id) {
                        if (!remotePlayers.has(p.id)) {
                            createRemotePlayer(p)
                        } else {
                            updateRemotePlayer(p.id, p.x, p.y)
                        }
                    }
                })
            }
        })
    })
    
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
    // Stop the timer
    stopTimer()
    
    // Play game end sound
    playSound('gameEnd')
    
    // Check if local player won
    if (data.winner && data.winner.id === socket.id) {
        playSound('winner')
    }
    
    // Update restart button text based on game mode
    const restartButton = document.getElementById('restart-button')
    if (restartButton) {
        if (playerData.mode === 'single') {
            restartButton.textContent = 'Back to Menu'
        } else {
            restartButton.textContent = 'Back to Lobby'
        }
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
    // Clear confirmation timeout for local bombs
    if (bombData.playerId === socket.id) {
        if (pendingConfirmations.has(bombData.bombId)) {
            clearTimeout(pendingConfirmations.get(bombData.bombId))
            pendingConfirmations.delete(bombData.bombId)
        }
        return
    }
    placeRemoteBomb(bombData)
})

// Server-authoritative bomb explosion (enables visible chain reactions)
socket.on('bomb:exploded', (bombData) => {
    handleServerBombExplosion(bombData)
})

socket.on('block:destroyed', (data) => {
    destroyBlockRemote(data.x, data.y)
})

socket.on('blocks:destroyed', (data) => {
    destroyBlocksRemote(data.blocks)
})

socket.on('powerup:spawned', (data) => {
    data.powerups.forEach(powerup => {
        renderPowerup(powerup)
    })
})

socket.on('powerup:picked', (data) => {
    // Remove powerup visually
    removePowerup(data.powerupId, data.x, data.y)
    
    // If remote player picked it up, apply the powerup to them
    if (data.playerId !== socket.id) {
        // Apply power-up to remote player
        addPowerupToPlayer(data.playerId, data.type)
    }
})

socket.on('powerup:granted', (data) => {
    // Apply power-up to the player
    import('./game/powerupController.js').then(({ addPowerupToPlayer }) => {
        addPowerupToPlayer(data.playerId, data.type)
        
        // Play sound if local player received it
        // Use different sound for immortal (special reward) vs regular pickup
        if (data.playerId === socket.id) {
            if (data.type === 'immortal') {
                playSound('powerupImmortal') // Special sound for immortal reward
            } else {
                playSound('powerupPickup') // Regular pickup sound
            }
        }
    })
})

socket.on('powerup:expired', (data) => {
    // Expiration is automatically handled in isPlayerImmortal when checked
    // Just trigger a check to update the visual
    import('./game/powerupController.js').then(({ isPlayerImmortal }) => {
        // Force check to update visual (will auto-expire and remove visual)
        isPlayerImmortal(data.playerId)
    })
})

socket.on('player:damaged', (data) => {
    // Update scoreboard for all players (local and remote)
    updatePlayerStats(data.playerId, { 
        lives: data.lives,
        alive: !data.died // Set alive based on died flag
    })
    
    // Handle local player damage
    if (data.playerId === socket.id) {
        if (player) {
            // Update lives from server (authoritative)
            player.lives = data.lives
            
            if (data.died) {
                player.die()
                playSound('playerDeath')
            } else {
                // Start invincibility animation for local player
                player.startInvincibility(2000)
                playSound('playerHit')
            }
        }
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
    // Also ensure invincibility animation is active if player is invincible
    const now = Date.now()
    if (player) {
        if (player.invincible && now < player.invincibilityEnd) {
            // Player should be invincible - ensure animation is active
            if (player.element && player.alive) {
                // Only set if not already set to avoid unnecessary style updates
                const currentAnimation = player.element.style.getPropertyValue('animation')
                if (!currentAnimation || !currentAnimation.includes('player-flash')) {
                    // Temporarily remove immortal class to allow flash animation
                    const hadImmortalClass = player.element.classList.contains('immortal')
                    if (hadImmortalClass) {
                        player.element.classList.remove('immortal')
                        player.element.dataset.wasImmortal = 'true'
                    }
                    player.element.style.setProperty('animation', 'player-flash 0.2s infinite', 'important')
                    player.element.style.opacity = '1'
                    player.element.style.filter = ''
                }
            }
        } else if (player.invincible && now >= player.invincibilityEnd) {
            // Invincibility expired
            player.invincible = false
            if (player.element && player.alive) {
                player.element.style.removeProperty('animation')
                player.element.style.opacity = '1'
                player.element.style.filter = ''
                // Restore immortal class if it was present before
                if (player.element.dataset.wasImmortal === 'true') {
                    player.element.classList.add('immortal')
                    delete player.element.dataset.wasImmortal
                }
            }
        }
    }
    remotePlayers.forEach(remotePlayer => {
        if (remotePlayer.invincible && now < remotePlayer.invincibilityEnd) {
            // Remote player should be invincible - ensure animation is active
            if (remotePlayer.element && remotePlayer.alive) {
                const currentAnimation = remotePlayer.element.style.getPropertyValue('animation')
                if (!currentAnimation || !currentAnimation.includes('player-flash')) {
                    // Temporarily remove immortal class to allow flash animation
                    const hadImmortalClass = remotePlayer.element.classList.contains('immortal')
                    if (hadImmortalClass) {
                        remotePlayer.element.classList.remove('immortal')
                        remotePlayer.element.dataset.wasImmortal = 'true'
                    }
                    remotePlayer.element.style.setProperty('animation', 'player-flash 0.2s infinite', 'important')
                    remotePlayer.element.style.opacity = '1'
                    remotePlayer.element.style.filter = ''
                }
            }
        } else if (remotePlayer.invincible && now >= remotePlayer.invincibilityEnd) {
            // Invincibility expired
            remotePlayer.invincible = false
            if (remotePlayer.element && remotePlayer.alive) {
                remotePlayer.element.style.removeProperty('animation')
                remotePlayer.element.style.opacity = '1'
                remotePlayer.element.style.filter = ''
                // Restore immortal class if it was present before
                if (remotePlayer.element.dataset.wasImmortal === 'true') {
                    remotePlayer.element.classList.add('immortal')
                    delete remotePlayer.element.dataset.wasImmortal
                }
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