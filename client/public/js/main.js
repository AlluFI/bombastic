import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, remotePlayers } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu } from "./ui/menu.js";
import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { isPaused, initializePauseMenu, setPaused } from "./ui/pause.js";
import { showGameScreen } from "./ui/menu.js";
import { intializeTimer, startTimer, stopTimer } from "./ui/timer.js";
import { intializeScorboard, renderScoreboard, addPlayerToScoreboard, removePlayerFromScoreboard } from "./ui/scoreboard.js";


const socket = io();
export { socket };

intializeMenu()
initializePauseMenu()
intializeTimer()
intializeScorboard()

// // Pass socket to pause module so it can emit events
// setSocket(socket)

let player
let lastPosition = { x: 1, y: 1 }

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

function gameLoop() {
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