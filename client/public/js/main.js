import { createLocalPlayer, createRemotePlayer, removeRemotePlayer, updateRemotePlayer, getLocalPlayer } from "./player.js";
import { updatePlayerMovement } from "./player.js";
import { updatePlayerRender } from "./renderPlayer.js";
import { intializeMenu } from "./ui/menu.js";
import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { isPaused, initializePauseMenu } from "./ui/pause.js";

const socket = io();

intializeMenu()
initializePauseMenu()

let player
let lastPosition = { x: 1, y: 1 }

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected with ID:', socket.id)
    
    // Tell server we joined
    socket.emit('player:join', {
        name: 'Player',
    })
})

// Receive current game state (existing players)
socket.on('game:state', (state) => {

    const myPlayer = state.allPlayers.find(p => p.id === socket.id)

    player = createLocalPlayer(myPlayer.id, myPlayer.name, myPlayer.x, myPlayer.y, myPlayer.color)

    state.allPlayers.forEach(p => {
        if (p.id !== socket.id) {
            createRemotePlayer(p)
        }
    })
})

// New player joined
socket.on('player:joined', (playerData) => {
    console.log('Player joined:', playerData.name)
    createRemotePlayer(playerData)
})

// Other player moved
socket.on('player:moved', (moveData) => {
    updateRemotePlayer(moveData.id, moveData.x, moveData.y)
})

// Player left
socket.on('player:left', (playerId) => {
    console.log('Player left:', playerId)
    removeRemotePlayer(playerId)
})

function gameLoop() {
    if (!player) {
        requestAnimationFrame(gameLoop)
        return
    }
    if(!isPaused) {
        updatePlayerMovement(player)
        updatePlayerRender(player)
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