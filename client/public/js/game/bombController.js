import { renderBomb, removeBomb, hasBombExploded, markBombAsExploded } from "../render/bombRender.js";
import { socket } from "../main.js";
import { map } from "../grid.js";
import { renderExplosion } from "../render/explosionRender.js";
import { destroyBlocksInTiles } from './blockController.js'
import { getPlayerBombRange, getPlayerMaxBombs } from './powerupController.js'
import { playSound } from '../audio/soundManager.js'

// MAX_BOMBS_PER_PLAYER is now dynamic based on power-ups (default 1)
const BOMB_DURATION = 3000
const BOMB_PLACEMENT_COOLDOWN = 300 // milliseconds between bomb placements (prevents spam)

//how many active bombs each player has
const playerBombs = new Map()

//Global bomb counter for unique IDs
let bombIdCounter = 0

const bombPositions = new Map()

// Track last bomb placement time per player to prevent spam
const lastBombPlacementTime = new Map()

// Track pending bomb confirmations to remove rejected bombs
const pendingConfirmations = new Map()

// Track explosions that have been rendered to prevent double rendering
const renderedExplosions = new Set()

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
    
    // Check if player already has max bombs (dynamic based on power-ups)
    const maxBombs = getPlayerMaxBombs(playerId)
    const bombCount = getPlayerBombCount(playerId)
    if (bombCount >= maxBombs) {
        return false
    }
    
    return true
}

export function tryPlaceBomb(player) {
    if (!player) {
        // console.warn('[Bomb] Cannot place bomb: no player object')
        return false
    }
    
    // Check if player can place another bomb (includes cooldown check)
    if (!canPlaceBomb(player.id)) {
        const maxBombs = getPlayerMaxBombs(player.id)
        const bombCount = getPlayerBombCount(player.id)
        // console.warn(`[Bomb] Cannot place bomb: canPlaceBomb returned false`, {
        //     playerId: player.id,
        //     position: { x: player.x, y: player.y },
        //     maxBombs,
        //     bombCount
        // })
        return false
    }

    const bombId = generateBombId(player.id)
    const x = player.x
    const y = player.y

    const validation = validateTile(x, y)
    if (!validation.valid) {
        // console.warn(`[Bomb] Cannot place bomb: invalid tile`, {
        //     playerId: player.id,
        //     position: { x, y },
        //     reason: validation.reason
        // })
        return false
    }
    
    // Double-check bomb count AFTER validation to prevent race conditions
    // This ensures we don't place multiple bombs if called rapidly
    const maxBombs = getPlayerMaxBombs(player.id)
    const bombCount = getPlayerBombCount(player.id)
    if (bombCount >= maxBombs) {
        // console.warn(`[Bomb] Cannot place bomb: max bombs reached`, {
        //     playerId: player.id,
        //     position: { x, y },
        //     maxBombs,
        //     bombCount
        // })
        return false
    }
    
    // Check if bomb already exists at this position (additional safety check)
    const posKey = `${x}-${y}`
    if (bombPositions.has(posKey)) {
        // console.warn(`[Bomb] Cannot place bomb: bomb already exists at position`, {
        //     playerId: player.id,
        //     position: { x, y }
        // })
        return false
    }

    // Track bomb BEFORE rendering to prevent race conditions
    trackBomb(player.id, bombId, x, y)

    // Set timeout to remove bomb if not confirmed by server within 5 seconds
    const confirmationTimeout = setTimeout(() => {
        untrackBomb(player.id, bombId, x, y)
        removeBomb(bombId)
        pendingConfirmations.delete(bombId)
    }, 5000)
    pendingConfirmations.set(bombId, confirmationTimeout)

    // Update last placement time to enforce cooldown
    lastBombPlacementTime.set(player.id, Date.now())
    
    // Play bomb placement sound
    playSound('bombPlace')
    
    // Get player's bomb range (from power-ups)
    const bombRange = getPlayerBombRange(player.id)
    
    // Render bomb locally
    // Client-side timeout will render explosion as fallback if server doesn't send bomb:exploded
    // Server will send bomb:exploded for chain reactions, which will also render the explosion
    renderBomb(bombId, x, y, BOMB_DURATION, (explodedBombId, bombX, bombY) => {
        // Always render explosion when client-side timeout fires
        // Mark as rendered to prevent server-side handler from rendering again
        const explosionKey = `${bombX}-${bombY}-${explodedBombId}`
        if (!renderedExplosions.has(explosionKey)) {
            renderedExplosions.add(explosionKey)
            playSound('explosion')
            renderExplosion(bombX, bombY, bombRange)
            
            // Clear the flag after explosion duration to allow re-rendering if needed
            setTimeout(() => {
                renderedExplosions.delete(explosionKey)
            }, 500)
        }
        
        // Untrack the bomb
        untrackBomb(player.id, explodedBombId, bombX, bombY)
    })

    if (socket) {
        if (!socket.connected) {
            // console.error(`[Bomb] Cannot send bomb placement - socket not connected`, {
            //     playerId: player.id,
            //     bombId,
            //     position: { x, y }
            // })
            // Untrack the bomb since we can't send it
            untrackBomb(player.id, bombId, x, y)
            return false
        }
        
        try {
            socket.emit('bomb:place', {
                bombId: bombId,
                playerId: player.id,
                x: x,
                y: y,
                duration: BOMB_DURATION,
                range: bombRange // Send range to server
            })
        } catch (error) {
            console.error(`[Bomb] Error sending bomb placement to server`, {
                playerId: player.id,
                bombId,
                position: { x, y },
                error: error.message
            })
            // Untrack the bomb since we can't send it
            untrackBomb(player.id, bombId, x, y)
            return false
        }
    }
    
    return true
}

export function placeRemoteBomb(bombData) {
    const { bombId, playerId, x, y, duration, range = 2 } = bombData

    // Track this bomb (with x, y for position tracking)
    trackBomb(playerId, bombId, x, y)

    // Render bomb
    // Client-side timeout will render explosion as fallback if server doesn't send bomb:exploded
    // Server will send bomb:exploded for chain reactions, which will also render the explosion
    renderBomb(bombId, x, y, duration, (explodedBombId, bombX, bombY) => {
        // Always render explosion when client-side timeout fires
        // The server-side handler will check if it was already rendered to prevent duplicates
        playSound('explosion')
        renderExplosion(bombX, bombY, range)
        
        // Untrack the bomb
        untrackBomb(playerId, explodedBombId, bombX, bombY)
    })
}

/**
 * Handle server-authoritative bomb explosion (e.g., chain reactions).
 * This removes the bomb locally and renders the explosion without applying client-side damage
 * (server already applies damage).
 */
export function handleServerBombExplosion({ bombId, playerId, x, y, range = 2 }) {
    // Mark as exploded before removing to prevent timeout callback from firing
    markBombAsExploded(bombId)
    
    // Remove local tracking so movement is not blocked after explosion
    untrackBomb(playerId, bombId, x, y)

    // Remove bomb element if it exists (this also clears timeouts)
    removeBomb(bombId)

    // Check if explosion was already rendered by client-side timeout
    const explosionKey = `${x}-${y}-${bombId}`
    if (!renderedExplosions.has(explosionKey)) {
        // Mark as rendered
        renderedExplosions.add(explosionKey)
        
        // Play explosion sound
        playSound('explosion')

        // Render explosion visuals with the bomb's range
        renderExplosion(x, y, range)
        
        // Clear the flag after explosion duration
        setTimeout(() => {
            renderedExplosions.delete(explosionKey)
        }, 500)
    }
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

export { pendingConfirmations }