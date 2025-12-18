

import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, remotePlayers } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu } from "./ui/menu.js";
import { isPaused, initializePauseMenu, setPaused } from "./ui/pause.js";
import { showGameScreen } from "./ui/menu.js";
import { intializeTimer, startTimer, stopTimer } from "./ui/timer.js";
import { intializeScorboard, renderScoreboard, addPlayerToScoreboard, removePlayerFromScoreboard } from "./ui/scoreboard.js";
import { renderBomb } from "./render/bombRender.js";
import { loadChatHistory, initializeChat } from "./ui/chat.js";

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

    //Bomb placement testing
    setTimeout(() => {
        console.log('Testing bomb placement')
        renderBomb('test-bomb-1', 2, 1, 3000, (bombId, x, y) => {
            console.log(`Bomb ${bombId} exploded at (${x}, ${y})!`)
        })
    }, 2000);
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
})

socket.on('room:updated', (state) => {
    console.log("Room updated:", state.players);
    
    // Only create local player if it doesn't exist yet
    if (!player) {
        const myPlayer = state.players.find(p => p.id === socket.id)
        player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)
        showGameScreen(state.roomCode)
        renderScoreboard(state.players, socket.id)
        loadChatHistory(state.chats)
    }

    // Only create remote players that don't already exist
    state.players.forEach(p => {
        if (p.id !== socket.id && !remotePlayers.has(p.id)) {
            createRemotePlayer(p)
            renderScoreboard(state.players, socket.id)
        }
    })
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