import { keys } from "./controls.js"
import { map } from "./grid.js"
import { tryPlaceBomb } from "./game/bombController.js"


const gridElement = document.getElementById('grid')

//Player object constructor class
class Player {
    constructor(id, name, x, y, color = 'blue') {
        this.id = id //add socket id later
        this.name = name
        this.x = x
        this.y = y
        this.color = color 
        this.lives = 3
        this.score = 0
        this.element = null 
    }

    createDomElement() {
        const el = document.createElement('div')
        el.classList.add('player')
        el.style.backgroundColor = this.color
        el.dataset.id = this.id

        this.element = el
        // Don't call updatePosition here - it will be called after element is added to DOM
        // This prevents errors when tiles don't exist yet
    }

    updatePosition() {
        if(!this.element) return

        //get player current position on the dom by referancing to the tile position
        const tile = document.getElementById(`tile-${this.x}-${this.y}`)
        if (!tile) {
            // Tile doesn't exist yet - grid might not be rendered
            // Try again on next frame
            console.warn(`Tile tile-${this.x}-${this.y} not found for player ${this.id}. Grid might not be ready.`)
            return
        }
        
        const tilePosition = tile.getBoundingClientRect()

        //Align the player to the tile
        this.element.style.position = 'absolute'
        this.element.style.left = tilePosition.left + 'px'
        this.element.style.top = tilePosition.top + 'px'

    }
}

let localPlayer
export const remotePlayers = new Map()

export function createLocalPlayer(id, name, x, y, color) {
    localPlayer = new Player(
       id || 'local',
     name || 'Player1',
        x || 1,
        y || 1,
    color || 'blue'
    );

    localPlayer.createDomElement()
    gridElement.appendChild(localPlayer.element)
    // Update position after element is added to DOM
    // Use requestAnimationFrame to ensure grid is rendered
    requestAnimationFrame(() => {
        if (localPlayer && localPlayer.element) {
            localPlayer.updatePosition()
        }
    })
    return localPlayer
}

export function createRemotePlayer(playerData) {
    
    const player = new Player(
        playerData.id,
        playerData.name,
        playerData.x,
        playerData.y,
        playerData.color
    )

    player.createDomElement()
    gridElement.appendChild(player.element)
    // Update position after element is added to DOM
    // Use requestAnimationFrame to ensure grid is rendered
    requestAnimationFrame(() => {
        const remotePlayer = remotePlayers.get(playerData.id)
        if (remotePlayer && remotePlayer.element) {
            remotePlayer.updatePosition()
        }
    })
    remotePlayers.set(playerData.id, player)
    return player
}

export function removeRemotePlayer(playerId) {
    const player = remotePlayers.get(playerId)
    if (player && player.element) {
        player.element.remove()
        remotePlayers.delete(playerId)
    }
}

export function removeLocalPlayer() {
    if (localPlayer && localPlayer.element) {
        localPlayer.element.remove()
        localPlayer = null
    }
}

export function clearAllPlayers() {
    // Remove local player
    removeLocalPlayer()
    
    // Remove all remote players
    remotePlayers.forEach((player, playerId) => {
        if (player.element) {
            player.element.remove()
        }
    })
    remotePlayers.clear()
}

export function updateRemotePlayer(playerId, x, y) {
    const player = remotePlayers.get(playerId)
    if (player) {
        player.x = x
        player.y = y
        // Only update position if element exists and tile exists
        if (player.element) {
            player.updatePosition()
        }
    }
}

export function getLocalPlayer() {
    return localPlayer
}

// Movement cooldown to prevent continuous movement (Bomberman-style grid movement)
let lastMovementTime = 0
const MOVEMENT_COOLDOWN = 150 // milliseconds between moves (allows ~6-7 moves per second)

export function updatePlayerMovement(player) {
    // Check bomb placement first (not affected by movement cooldown)
    if (keys.space) {
        tryPlaceBomb(player)
        keys.space = false  // Prevent holding spacebar to spam bombs
    }
    
    const now = Date.now()
    const timeSinceLastMove = now - lastMovementTime
    
    // Only allow movement if enough time has passed since last move
    if (timeSinceLastMove < MOVEMENT_COOLDOWN) {
        return
    }
    
    let newX = player.x
    let newY = player.y
    let moved = false

    if (keys.up) {
        newX--
        moved = true
    } else if (keys.down) {
        newX++
        moved = true
    } else if (keys.left) {
        newY--
        moved = true
    } else if (keys.right) {
        newY++
        moved = true
    }
    
    // Only process movement if a key is pressed
    if (!moved) {
        return
    }

    //check if player can move 
    if(map[newX] && map[newX][newY] === 'empty') {
        player.x = newX
        player.y = newY
        player.updatePosition()
        lastMovementTime = now // Update cooldown only on successful move
    } else if (newX !== player.x || newY !== player.y) {
        // Movement blocked - still apply cooldown to prevent spam when blocked
        lastMovementTime = now
        // Debug: log blocked movement
        const blockedReason = !map[newX] ? 'out of bounds' : 
                              map[newX][newY] === 'breakable' ? 'block' : 
                              map[newX][newY] === 'solid' ? 'wall' : 'unknown';
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
            console.log(`Movement blocked at (${newX}, ${newY}): ${blockedReason}. Current pos: (${player.x}, ${player.y})`);
        }
    }
}