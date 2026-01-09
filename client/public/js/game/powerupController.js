import { map } from '../grid.js'
import { socket } from '../main.js'
import { getLocalPlayer } from '../player.js'
import { playSound } from '../audio/soundManager.js'

const POWERUP_TYPES = {
    BOMB_RANGE: 'bomb_range',
    IMMORTAL: 'immortal'
}

// Track active power-ups on the map
const activePowerups = new Map() // posKey -> { id, type, x, y }

// Track player power-up stats
const playerStats = new Map() // playerId -> { bombRange: 2, immortal: false, immortalEnd: 0 }

export function initializePlayerStats(playerId) {
    if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
            bombRange: 2, // Default range
            immortal: false,
            immortalEnd: 0
        })
    }
}

export function getPlayerBombRange(playerId) {
    const stats = playerStats.get(playerId)
    return stats ? stats.bombRange : 2
}

export function addPowerupToPlayer(playerId, powerupType) {
    initializePlayerStats(playerId)
    const stats = playerStats.get(playerId)
    
    if (powerupType === POWERUP_TYPES.BOMB_RANGE) {
        stats.bombRange += 1 // Increase range by 1
        console.log(`Player ${playerId} picked up bomb range power-up! New range: ${stats.bombRange}`)
    } else if (powerupType === POWERUP_TYPES.IMMORTAL) {
        // Grant 15 seconds of immortality
        const IMMORTAL_DURATION = 15000
        stats.immortal = true
        stats.immortalEnd = Date.now() + IMMORTAL_DURATION
        console.log(`Player ${playerId} gained immortality for 15 seconds!`)
        
        // Update visual indicator
        updateImmortalVisual(playerId, true)
        
        // Auto-remove after duration
        setTimeout(() => {
            if (stats.immortalEnd <= Date.now()) {
                stats.immortal = false
                stats.immortalEnd = 0
                updateImmortalVisual(playerId, false)
                console.log(`Player ${playerId} immortality expired`)
            }
        }, IMMORTAL_DURATION)
    }
}

export function isPlayerImmortal(playerId) {
    const stats = playerStats.get(playerId)
    if (!stats) return false
    
    // Check if immortal and not expired
    if (stats.immortal && Date.now() < stats.immortalEnd) {
        return true
    }
    
    // Auto-expire if time passed
    if (stats.immortal && Date.now() >= stats.immortalEnd) {
        stats.immortal = false
        stats.immortalEnd = 0
        updateImmortalVisual(playerId, false)
    }
    
    return false
}

function updateImmortalVisual(playerId, isImmortal) {
    // Import dynamically to avoid circular dependency
    import('../player.js').then(({ getLocalPlayer, remotePlayers }) => {
        const localPlayer = getLocalPlayer()
        
        let playerElement = null
        
        if (localPlayer && localPlayer.id === playerId) {
            playerElement = localPlayer.element
        } else {
            const remotePlayer = remotePlayers.get(playerId)
            if (remotePlayer) {
                playerElement = remotePlayer.element
            }
        }
        
        if (playerElement) {
            if (isImmortal) {
                playerElement.classList.add('immortal')
            } else {
                playerElement.classList.remove('immortal')
            }
        }
    })
}

export function renderPowerup(powerupData) {
    const { id, type, x, y } = powerupData
    
    const posKey = `${x}-${y}`
    
    // Check if power-up already exists at this position
    if (activePowerups.has(posKey)) {
        console.warn(`Power-up already exists at (${x}, ${y})`)
        return
    }
    
    // Get tile element
    const tileElement = document.getElementById(`tile-${x}-${y}`)
    if (!tileElement) {
        console.error(`Tile element not found: tile-${x}-${y}`)
        return
    }
    
    // Create power-up element
    const powerupElement = document.createElement('div')
    powerupElement.className = `powerup powerup-${type}`
    powerupElement.id = `powerup-${id}`
    powerupElement.dataset.powerupId = id
    powerupElement.dataset.x = x
    powerupElement.dataset.y = y
    
    // Add icon based on type
    if (type === POWERUP_TYPES.BOMB_RANGE) {
        powerupElement.innerHTML = '💣'
        powerupElement.title = 'Bomb Range +1'
    }
    
    // Position power-up on tile (centered)
    const tileRect = tileElement.getBoundingClientRect()
    powerupElement.style.position = 'absolute'
    powerupElement.style.left = `${tileRect.left + (tileRect.width / 2) - 10}px`
    powerupElement.style.top = `${tileRect.top + (tileRect.height / 2) - 10}px`
    powerupElement.style.width = '20px'
    powerupElement.style.height = '20px'
    powerupElement.style.fontSize = '20px'
    powerupElement.style.zIndex = '100'
    powerupElement.style.pointerEvents = 'none'
    powerupElement.style.animation = 'powerup-float 2s ease-in-out infinite'
    powerupElement.style.textAlign = 'center'
    powerupElement.style.lineHeight = '20px'
    powerupElement.style.display = 'flex'
    powerupElement.style.alignItems = 'center'
    powerupElement.style.justifyContent = 'center'
    
    // Add to grid
    const grid = document.getElementById('grid')
    if (grid) {
        grid.appendChild(powerupElement)
    }
    
    // Track power-up
    activePowerups.set(posKey, { id, type, x, y, element: powerupElement })
    
    // Play power-up spawn sound
    playSound('powerupSpawn', { volume: 0.6 })
    
    console.log(`Power-up rendered at (${x}, ${y}): ${type}`)
}

export function removePowerup(powerupId, x, y) {
    const posKey = `${x}-${y}`
    const powerup = activePowerups.get(posKey)
    
    // Try to find by position first
    if (powerup && powerup.element) {
        powerup.element.remove()
        activePowerups.delete(posKey)
        return true
    }
    
    // If not found by position, try to find by ID (fallback)
    for (const [key, pw] of activePowerups.entries()) {
        if (pw.id === powerupId) {
            if (pw.element) {
                pw.element.remove()
            }
            activePowerups.delete(key)
            return true
        }
    }
    
    return false
}

export function checkPowerupPickup(player) {
    if (!player || !player.alive) return
    
    const posKey = `${player.x}-${player.y}`
    const powerup = activePowerups.get(posKey)
    
    if (powerup) {
        // Play power-up pickup sound
        playSound('powerupPickup')
        
        // Apply power-up to player locally first (for immediate feedback)
        addPowerupToPlayer(player.id, powerup.type)
        
        // Notify server
        if (socket) {
            socket.emit('powerup:pickup', {
                powerupId: powerup.id,
                playerId: player.id,
                x: player.x,
                y: player.y
            })
        }
        
        // Remove power-up locally
        removePowerup(powerup.id, player.x, player.y)
    }
}

export function clearAllPowerups() {
    activePowerups.forEach((powerup, posKey) => {
        if (powerup.element) {
            powerup.element.remove()
        }
    })
    activePowerups.clear()
}

export function getPowerupAtPosition(x, y) {
    const posKey = `${x}-${y}`
    return activePowerups.get(posKey)
}

