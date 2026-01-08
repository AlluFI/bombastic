import { keys } from "./controls.js"
import { map } from "./grid.js"
import { tryPlaceBomb, getBombPositions } from "./game/bombController.js"
import { isPlayerImmortal } from "./game/powerupController.js"


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
        this.alive = true
        this.invincible = false
        this.invincibilityEnd = 0
        this.element = null 
    }
    
    takeDamage() {
        if (!this.alive) return false
        
        // Check immortal state (from power-up)
        if (isPlayerImmortal(this.id)) {
            console.log(`${this.name} is immortal! Damage blocked.`)
            return false
        }
        
        // Check invincibility (short-term after taking damage)
        if (this.invincible && Date.now() < this.invincibilityEnd) {
            console.log(`${this.name} is invincible! Damage blocked.`)
            return false
        }
        
        this.lives--
        console.log(`${this.name} took damage! Lives remaining: ${this.lives}`)
        
        // Start invincibility (2 seconds)
        this.startInvincibility(2000)
        
        if (this.lives <= 0) {
            this.die()
            return true // Player died
        }
        return false // Player still alive
    }
    
    startInvincibility(duration = 2000) {
        this.invincible = true
        this.invincibilityEnd = Date.now() + duration
        
        // Flash animation
        if (this.element) {
            this.element.style.animation = 'player-flash 0.2s infinite'
            // Ensure element is visible (in case it was hidden)
            this.element.style.opacity = '1'
            this.element.style.filter = ''
        }
        
        // Remove invincibility after duration
        setTimeout(() => {
            this.invincible = false
            if (this.element) {
                // Clear animation
                this.element.style.animation = ''
                // Ensure element is visible and normal after invincibility ends
                if (this.alive) {
                    this.element.style.opacity = '1'
                    this.element.style.filter = ''
                }
            }
        }, duration)
    }
    
    die() {
        this.alive = false
        console.log(`${this.name} has died!`)
        
        // Stop invincibility animation if active
        this.invincible = false
        
        // Visual feedback - make player semi-transparent or hide
        if (this.element) {
            this.element.style.animation = '' // Remove flashing animation
            this.element.style.opacity = '0.3'
            this.element.style.filter = 'grayscale(100%)'
        }
    }

    createDomElement() {
        const el = document.createElement('div')
        el.classList.add('player')
        el.style.backgroundColor = this.color
        el.dataset.id = this.id

        el.innerHTML = this.createCharacterSVG()

        this.element = el
    }

    createCharacterSVG() {
    // Bomberman-style character
    return `
        <svg width="30" height="35" viewBox="0 0 30 35" xmlns="http://www.w3.org/2000/svg">
            <!-- Head -->
            <circle cx="15" cy="12" r="9" fill="#ffd1a3" stroke="#333" stroke-width="2"/>
            
            <!-- Eyes -->
            <circle cx="11" cy="11" r="2" fill="#000"/>
            <circle cx="19" cy="11" r="2" fill="#000"/>
            
            <!-- Smile -->
            <path d="M 10 15 Q 15 18 20 15" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            
            <!-- Body -->
            <rect x="6" y="20" width="18" height="13" rx="3" fill="${this.color}" stroke="#333" stroke-width="2"/>
            
            <!-- Arms (optional) -->
            <rect x="2" y="22" width="5" height="8" rx="2" fill="${this.color}" stroke="#333" stroke-width="1.5"/>
            <rect x="23" y="22" width="5" height="8" rx="2" fill="${this.color}" stroke="#333" stroke-width="1.5"/>
        </svg>
    `
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

export function createLocalPlayer(id, name, x, y, color, playerData = {}) {
    localPlayer = new Player(
       id || 'local',
     name || 'Player1',
        x || 1,
        y || 1,
    color || 'blue'
    );
    
    // Set additional properties from playerData
    if (playerData.lives !== undefined) localPlayer.lives = playerData.lives
    if (playerData.alive !== undefined) localPlayer.alive = playerData.alive

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
    
    // Set additional properties from playerData
    if (playerData.lives !== undefined) player.lives = playerData.lives
    if (playerData.alive !== undefined) player.alive = playerData.alive

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

export function getPlayersAtPosition(x, y) {
    const players = []
    
    // Check local player
    if (localPlayer && localPlayer.alive && localPlayer.x === x && localPlayer.y === y) {
        players.push(localPlayer)
    }
    
    // Check remote players
    remotePlayers.forEach(player => {
        if (player.alive && player.x === x && player.y === y) {
            players.push(player)
        }
    })
    
    return players
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
    // Dead players can't move or place bombs
    if (!player.alive) {
        return
    }
    
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
        player.element?.classList.add('facing-up')
        player.element?.classList.remove('facing-down', 'facing-left', 'facing-right')
    } else if (keys.down) {
        newX++
        moved = true
        player.element?.classList.add('facing-down')
        player.element?.classList.remove('facing-up', 'facing-left', 'facing-right')
    } else if (keys.left) {
        newY--
        moved = true
        player.element?.classList.add('facing-left')
        player.element?.classList.remove('facing-up', 'facing-down', 'facing-right')
    } else if (keys.right) {
        newY++
        moved = true
        player.element?.classList.add('facing-right')
        player.element?.classList.remove('facing-up', 'facing-down', 'facing-right')
    }
    
    // Only process movement if a key is pressed
    if (!moved) {
        return
    }

    // Check if target position is walkable (not a block/wall, not a bomb, and not another player/NPC)
    const isWalkable = map[newX] && map[newX][newY] === 'empty'
    const bombPositions = getBombPositions()
    const hasBomb = bombPositions.some(bomb => bomb.x === newX && bomb.y === newY)
    const playersAtTarget = getPlayersAtPosition(newX, newY)
    const hasPlayer = playersAtTarget.length > 0 && !playersAtTarget.some(p => p.id === player.id)
    
    if (isWalkable && !hasBomb && !hasPlayer) {
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
                              map[newX][newY] === 'solid' ? 'wall' : 
                              hasBomb ? 'bomb' : 
                              hasPlayer ? 'player/npc' : 'unknown';
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
            console.log(`Movement blocked at (${newX}, ${newY}): ${blockedReason}. Current pos: (${player.x}, ${player.y})`);
        }
    }
}