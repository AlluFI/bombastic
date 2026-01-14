import { keys } from "./controls.js"
import { map } from "./grid.js"
import { tryPlaceBomb, getBombPositions } from "./game/bombController.js"
import { isPlayerImmortal, initializePlayerStats } from "./game/powerupController.js"


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
            return false
        }
        
        // Check invincibility (short-term after taking damage)
        if (this.invincible && Date.now() < this.invincibilityEnd) {
            return false
        }
        
        this.lives--
        
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
            // Temporarily remove immortal class to allow flash animation
            const hadImmortalClass = this.element.classList.contains('immortal')
            if (hadImmortalClass) {
                this.element.classList.remove('immortal')
            }
            
            this.element.style.setProperty('animation', 'player-flash 0.2s infinite', 'important')
            // Ensure element is visible (in case it was hidden)
            this.element.style.opacity = '1'
            this.element.style.filter = ''
            
            // Store the immortal class state to restore later
            this.element.dataset.wasImmortal = hadImmortalClass ? 'true' : 'false'
        }
        
        // Remove invincibility after duration
        setTimeout(() => {
            this.invincible = false
            if (this.element) {
                // Clear animation
                this.element.style.removeProperty('animation')
                // Ensure element is visible and normal after invincibility ends
                if (this.alive) {
                    this.element.style.opacity = '1'
                    this.element.style.filter = ''
                    
                    // Restore immortal class if it was present before
                    if (this.element.dataset.wasImmortal === 'true') {
                        this.element.classList.add('immortal')
                    }
                    delete this.element.dataset.wasImmortal
                }
            }
        }, duration)
    }
    
    die() {
        this.alive = false
        
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
            return
        }
        
        const grid = document.getElementById('grid')
        if (!grid) return
        
        const tileRect = tile.getBoundingClientRect()
        const gridRect = grid.getBoundingClientRect()

        //Align the player to the tile - calculate position relative to grid container
        const newLeft = (tileRect.left - gridRect.left) + 'px'
        const newTop = (tileRect.top - gridRect.top) + 'px'
        
        if (this.element.style.left !== newLeft) {
            this.element.style.left = newLeft
        }
        if (this.element.style.top !== newTop) {
            this.element.style.top = newTop
        }
        if (this.element.style.position !== 'absolute') {
            this.element.style.position = 'absolute'
        }

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
    
    // Ensure grid element exists and is accessible
    if (!gridElement) {
        return localPlayer
    }
    
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
    
    // Ensure grid element exists and is accessible
    if (!gridElement) {
        return
    }
    
    gridElement.appendChild(player.element)
    
    // Initialize player stats for powerup tracking
   
        initializePlayerStats(playerData.id)
 
    
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
    // If this update is for the local player, update them directly (authoritative from server)
    if (localPlayer && localPlayer.id === playerId) {
        localPlayer.x = x
        localPlayer.y = y
        localPlayer.updatePosition()
        return
    }

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

// Bomb placement cooldown tracking
let lastBombPlacementAttempt = 0
const BOMB_PLACEMENT_COOLDOWN = 300 // milliseconds between bomb placement attempts (prevents spam)

export function updatePlayerMovement(player) {
    // Dead players can't move or place bombs
    if (!player.alive) {
        return
    }
    
    // Check bomb placement first (with cooldown to prevent spam)
    const now = Date.now()
    if (keys.space && (now - lastBombPlacementAttempt) >= BOMB_PLACEMENT_COOLDOWN) {
        const placed = tryPlaceBomb(player)
        if (placed) {
            lastBombPlacementAttempt = now
        }
        keys.space = false  // Prevent holding spacebar to spam bombs
    }
    
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
    }
}