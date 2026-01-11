import { renderBomb, removeBomb, hasBombExploded, markBombAsExploded } from "../render/bombRender.js";
import { socket } from "../main.js";
import { map } from "../grid.js";
import { renderExplosion } from "../render/explosionRender.js";
import { destroyBlocksInTiles } from './blockController.js'
import { getPlayerBombRange } from './powerupController.js'
import { playSound } from '../audio/soundManager.js'

const MAX_BOMBS_PER_PLAYER = 1
const BOMB_DURATION = 3000
const BOMB_PLACEMENT_COOLDOWN = 300 // milliseconds between bomb placements (prevents spam)

//how many active bombs each player has
const playerBombs = new Map()

//Global bomb counter for unique IDs
let bombIdCounter = 0

const bombPositions = new Map()

// Track last bomb placement time per player to prevent spam
const lastBombPlacementTime = new Map()

function generateBombId(playerId) {
    bombIdCounter++
    return `${playerId}-bomb-${bombIdCounter}-${Date.now()}`
}

function getPlayerBombCount(playerId) {
    const bombs = playerBombs.get(playerId)
    return bombs ? bombs.size : 0
}

function trackBomb(playerId, bombId, x, y) {
    if (!playerBombs.has(playerId)) {
        playerBombs.set(playerId, new Set())
    }

    playerBombs.get(playerId).add(bombId)

    const posKey = `${x}-${y}`
    bombPositions.set(posKey, bombId)
}

export function untrackBomb(playerId, bombId, x, y) {
    const bombs = playerBombs.get(playerId)
    if (bombs) {
        bombs.delete(bombId)
    }

    const posKey = `${x}-${y}`
    bombPositions.delete(posKey)
}

//validation checks for bomb placement
//player is not able to move if the tile is empty, but this is an extra layer to ensure that bombs
//cannot be placed on a tile other than empty
function validateTile(x, y) {
    //check bounds
    if (!map[x] || map[x][y] === undefined) {
        return {
            valid: false,
            reason: 'Position out of bounds'
        }
    }

    const tileType = map[x][y]

    if (tileType === 'solid') {
        return {
            valid: false,
            reason: 'Cannot place bomb on solid wall'
        }
    }
    
    if (tileType === 'breakable') {
        return {
            valid: false,
            reason: 'Cannot place bomb on breakable block'
        }
    }

    if (tileType !== 'empty') {
        return {
            valid: false,
            reason: `Cannot place bomb on tile type: ${tileType}`
        }
    }

    const posKey = `${x}-${y}`
    if (bombPositions.has(posKey)) {
        return {
            valid: false,
            reason: 'Bomb already exists at this position'
        }
    }

    return {
        valid: true,
        reason: 'Valid position'
    }
}

function canPlaceBomb(playerId) {
    // Check cooldown to prevent spam
    const lastPlacement = lastBombPlacementTime.get(playerId)
    const now = Date.now()
    if (lastPlacement && (now - lastPlacement) < BOMB_PLACEMENT_COOLDOWN) {
        // Still in cooldown - ignore bomb placement
        return false
    }
    
    // Check if player already has max bombs
    const bombCount = getPlayerBombCount(playerId)
    if (bombCount >= MAX_BOMBS_PER_PLAYER) {
        return false
    }
    
    return true
}

export function tryPlaceBomb(player) {
    if (!player) {
        return false
    }
    
    // Check if player can place another bomb (includes cooldown check)
    if (!canPlaceBomb(player.id)) {
        return false
    }

    const bombId = generateBombId(player.id)
    const x = player.x
    const y = player.y

    const validation = validateTile(x, y)
    if (!validation.valid) {
        return false
    }
    
    // Double-check bomb count AFTER validation to prevent race conditions
    // This ensures we don't place multiple bombs if called rapidly
    if (getPlayerBombCount(player.id) >= MAX_BOMBS_PER_PLAYER) {
        return false
    }
    
    // Check if bomb already exists at this position (additional safety check)
    const posKey = `${x}-${y}`
    if (bombPositions.has(posKey)) {
        return false
    }

    // Track bomb BEFORE rendering to prevent race conditions
    trackBomb(player.id, bombId, x, y)
    
    // Update last placement time to enforce cooldown
    lastBombPlacementTime.set(player.id, Date.now())
    
    // Play bomb placement sound
    playSound('bombPlace')
    
    // Get player's bomb range (from power-ups)
    const bombRange = getPlayerBombRange(player.id)
    
    // Render bomb locally
    renderBomb(bombId, x, y, BOMB_DURATION, (explodedBombId, bombX, bombY) => {
        // Play explosion sound
        playSound('explosion')
        
        // Untrack the bomb
        untrackBomb(player.id, explodedBombId, bombX, bombY)
        
        // Render explosion with player's bomb range (bomb exploded)
        renderExplosion(bombX, bombY, bombRange, (centerX, centerY, affectedTiles, breakableBlocks) => {
            // Destroy breakable blocks
            if (breakableBlocks && breakableBlocks.length > 0) {
                const destroyed = destroyBlocksInTiles(breakableBlocks)
                // Play block destruction sound for each block
                destroyed.forEach(() => {
                    playSound('blockDestroy', { volume: 0.7 })
                })
            }
            
            // Note: Player damage is handled server-side via 'player:damaged' events
            // No client-side damage calculation needed
        })
    })

    if (socket) {
        socket.emit('bomb:place', {
            bombId: bombId,
            playerId: player.id,
            x: x,
            y: y,
            duration: BOMB_DURATION,
            range: bombRange // Send range to server
        })
    }
    
    return true
}

export function placeRemoteBomb(bombData) {
    const { bombId, playerId, x, y, duration, range = 2 } = bombData
    
    // Track this bomb (with x, y for position tracking)
    trackBomb(playerId, bombId, x, y)
    
    // Render bomb
    renderBomb(bombId, x, y, duration, (explodedBombId, bombX, bombY) => {
        untrackBomb(playerId, explodedBombId, bombX, bombY)
        
        // Play explosion sound for remote bomb
        playSound('explosion')
        
        // Render explosion with the bomb's range
        renderExplosion(bombX, bombY, range, (centerX, centerY, affectedTiles) => {
            // Note: Player damage is handled server-side via 'player:damaged' events
            // No client-side damage calculation needed
        })
    })
}

/**
 * Handle server-authoritative bomb explosion (e.g., chain reactions).
 * This removes the bomb locally and renders the explosion without applying client-side damage
 * (server already applies damage).
 */
export function handleServerBombExplosion({ bombId, playerId, x, y, range = 2 }) {
    // Check if bomb already exploded client-side (prevents double explosion rendering)
    if (hasBombExploded(bombId)) {
        return
    }
    
    // Mark as exploded before removing to prevent timeout callback from firing
    markBombAsExploded(bombId)
    
    // Remove local tracking so movement is not blocked after explosion
    untrackBomb(playerId, bombId, x, y)

    // Remove bomb element if it exists (this also clears timeouts)
    removeBomb(bombId)

    // Play explosion sound
    playSound('explosion')

    // Render explosion visuals with the bomb's range
    renderExplosion(x, y, range)
}

export function clearPlayerBombs(playerId) {
    const bombs = playerBombs.get(playerId)
    if (bombs) {
        bombs.forEach(bombId => {
            removeBomb(bombId)
            
            // Remove from position tracking
            for (const [posKey, storedBombId] of bombPositions.entries()) {
                if (storedBombId === bombId) {
                    bombPositions.delete(posKey)
                    break
                }
            }
        })
        playerBombs.delete(playerId)
    }
    
    // Clear bomb placement cooldown when all bombs are cleared (e.g., new game)
    lastBombPlacementTime.delete(playerId)
}

export function clearAllBombs() {
    playerBombs.forEach((_, playerId) => {
        clearPlayerBombs(playerId)
    })
    bombPositions.clear()
}

export function getBombPositions() {
    const positions = []
    bombPositions.forEach((bombId, posKey) => {
        const [x, y] = posKey.split('-').map(Number)
        positions.push({ x, y, bombId })
    })
    return positions
}