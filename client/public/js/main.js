import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, remotePlayers, clearAllPlayers } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu, playerData } from "./ui/menu.js";
import { isPaused, initializePauseMenu, setPaused } from "./ui/pause.js";
import { showGameScreen, showEndScreen, showMenuScreen } from "./ui/menu.js";
import { intializeTimer, startTimer, stopTimer } from "./ui/timer.js";
import { intializeScorboard, renderScoreboard, addPlayerToScoreboard, removePlayerFromScoreboard } from "./ui/scoreboard.js";
import { placeRemoteBomb, clearPlayerBombs } from "./game/bombController.js";
import { loadChatHistory, initializeChat } from "./ui/chat.js";
import { destroyBlockRemote, destroyBlocksRemote } from "./game/blockController.js"


const socket = io()
export { socket };

intializeMenu()
initializePauseMenu()
intializeTimer()
intializeScorboard()
initializeChat(socket)

let player
let lastPosition = { x: 1, y: 1 }

export function resetPlayer() {
    player = null
    lastPosition = { x: 1, y: 1 }
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected with ID:', socket.id) 
})

// Receive current game state (existing players)
socket.on('game:state', (state) => {

    const myPlayer = state.allPlayers.find(p => p.id === socket.id)

    player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)

    showGameScreen()
    startTimer()
    renderScoreboard(state.allPlayers, socket.id)
    
    state.allPlayers.forEach(p => {
        if (p.id !== socket.id) {
            createRemotePlayer(p)
        }
    })
})

socket.on('room:created', (state) => {
    const myPlayer = state.players.find(p => p.id === socket.id)

    player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)

    state.players.forEach(p => {
        if (p.id !== socket.id) {
            createRemotePlayer(p)
        }
    })

    showGameScreen(state.roomCode)
    renderScoreboard(state.players, socket.id)
    loadChatHistory(state.chats)
    
    // If this is a single-player game, configure NPCs
    if (playerData.mode === 'single') {
        // Set game mode to single-player
        socket.emit('set-game-mode', {
            mode: 'single-player'
        })
        
        // Configure NPCs with selected count and difficulty
        const difficulties = Array(playerData.npcCount).fill(playerData.difficulty)
        socket.emit('configure-npcs', {
            count: playerData.npcCount,
            difficulties: difficulties
        })
        
        console.log(`Single-player game started with ${playerData.npcCount} NPC(s) at ${playerData.difficulty} difficulty`)
    }
})

socket.on('room:updated', (state) => {
    console.log("Room updated:", state.players);
    
    // Only create local player if it doesn't exist yet
    if (!player) {
        const myPlayer = state.players.find(p => p.id === socket.id)
        if (myPlayer) {
            player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)
            showGameScreen(state.roomCode)
            renderScoreboard(state.players, socket.id)
            loadChatHistory(state.chats)
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
    // Request room update to get NPCs in the players list
    // The server will emit room:updated with NPCs included
})

// Handle game mode change confirmation
socket.on('game-mode-changed', (data) => {
    console.log(`Game mode changed to: ${data.mode}`)
})

// Handle game end (winner detection)
socket.on('game:end', (data) => {
    console.log('Game ended:', data)
    
    // Stop the timer
    stopTimer()
    
    // Display end screen with winner information
    const winnerText = document.getElementById('winner-text')
    if (winnerText) {
        if (data.isDraw) {
            winnerText.textContent = 'Draw! All players eliminated.'
        } else if (data.winner) {
            const winnerName = data.winner.isNPC ? `${data.winner.name} (Bot)` : data.winner.name
            winnerText.textContent = `Winner: ${winnerName}!`
        } else {
            winnerText.textContent = 'Game Over'
        }
    }
    
    // Show final scoreboard
    if (data.players) {
        renderScoreboard(data.players, socket.id)
    }
    
    // Show end screen
    showEndScreen()
    
    // Reset player state for next game
    resetPlayer()
    clearAllPlayers()
})

socket.on('error', (data) => {
alert(data.message)

})

// New player joined
socket.on('player:joined', (playerData) => {
    console.log('Player joined:', playerData.name)
    createRemotePlayer(playerData)

    addPlayerToScoreboard(playerData)
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

socket.on('block:destroyed', (data) => {
    console.log('Block destroyed by server:', data)
    destroyBlockRemote(data.x, data.y)
})


socket.on('blocks:destroyed', (data) => {
    console.log(`${data.blocks.length} blocks destroyed by server`)
    destroyBlocksRemote(data.blocks)
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
        updatePlayerRender(player)
        
        // Also update all remote players' rendering
        remotePlayers.forEach(remotePlayer => {
            updatePlayerRender(remotePlayer)
        })
    } 
    
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