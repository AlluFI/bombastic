import { renderBomb, removeBomb } from "../render/bombRender.js";
import { socket } from "../main.js";
import { map } from "../grid.js";
import { renderExplosion } from "../render/explosionRender.js";
import { destroyBlocksInTiles } from './blockController.js'
import { getPlayersAtPosition, getLocalPlayer } from '../player.js'

const MAX_BOMBS_PER_PLAYER = 1
const BOMB_DURATION = 3000

//how many active bombs each player has
const playerBombs = new Map()

//Global bomb counter for unique IDs
let bombIdCounter = 0

const bombPositions = new Map()

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
    console.log(`Player ${playerId} now has ${getPlayerBombCount(playerId)} bomb(s)`)
}

export function untrackBomb(playerId, bombId, x, y) {
    const bombs = playerBombs.get(playerId)
    if (bombs) {
        bombs.delete(bombId)
        console.log(`Player ${playerId} now has ${getPlayerBombCount(playerId)} bomb(s)`)
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
    const bombCount = getPlayerBombCount(playerId)
    
    if (bombCount >= MAX_BOMBS_PER_PLAYER) {
        console.log(`Player ${playerId} already has max bombs (${MAX_BOMBS_PER_PLAYER})`)
        return false
    }
    
    return true
}

export function tryPlaceBomb(player) {
    if (!player) {
        console.warn('No player to place bomb')
        return false
    }
    
    // Check if player can place another bomb
    if (!canPlaceBomb(player.id)) {
        return false
    }

    const bombId = generateBombId(player.id)
    const x = player.x
    const y = player.y

    const validation = validateTile(x, y)
    if (!validation.valid) {
        console.log(`Cannot place bomb: ${validation.reason}`)
        return false
    }   
    
    console.log(`Placing bomb at (${x}, ${y})`)

    trackBomb(player.id, bombId, x, y)
    
    // Render bomb locally
    renderBomb(bombId, x, y, BOMB_DURATION, (explodedBombId, bombX, bombY) => {
        console.log(`Bomb ${explodedBombId} exploded at (${bombX}, ${bombY})`)
        
        // Untrack the bomb
        untrackBomb(player.id, explodedBombId, bombX, bombY)
        
        // Render explosion
        renderExplosion(bombX, bombY, 2, (centerX, centerY, affectedTiles, breakableBlocks) => {
            console.log(`Explosion complete at (${centerX}, ${centerY})`)
            console.log(`Affected ${affectedTiles.length} tiles`)
            
            // Destroy breakable blocks
            if (breakableBlocks && breakableBlocks.length > 0) {
                const destroyed = destroyBlocksInTiles(breakableBlocks)
                console.log(`Destroyed ${destroyed.length} blocks`)
            }
            
            // Check for player damage
            const hitPlayers = new Set() // Use Set to ensure uniqueness
            affectedTiles.forEach(tile => {
                const playersAtTile = getPlayersAtPosition(tile.x, tile.y)
                playersAtTile.forEach(player => {
                    if (!hitPlayers.has(player.id)) {
                        hitPlayers.add(player.id)
                        
                        // If it's the local player, apply damage and notify server
                        if (player.id === getLocalPlayer()?.id) {
                            console.log(`Applying damage to local player ${player.name} at (${player.x}, ${player.y})`)
                            const died = player.takeDamage()
                            
                            // Update scoreboard hearts
                            import('../ui/scoreboard.js').then(({ updatePlayerStats }) => {
                                updatePlayerStats(player.id, { lives: player.lives })
                            })
                            
                            // Notify server of damage
                            if (socket) {
                                socket.emit('player:damage', {
                                    playerId: player.id,
                                    lives: player.lives,
                                    died: died
                                })
                            }
                        }
                    }
                })
            })
            
            if (hitPlayers.size > 0) {
                console.log(`Explosion hit ${hitPlayers.size} player(s):`, Array.from(hitPlayers))
            }
        })
    })

    if (socket) {
        socket.emit('bomb:place', {
            bombId: bombId,
            playerId: player.id,
            x: x,
            y: y,
            duration: BOMB_DURATION
        })
    }
    
    return true
}

export function placeRemoteBomb(bombData) {
    const { bombId, playerId, x, y, duration } = bombData
    
    console.log(`Remote bomb placed by ${playerId} at (${x}, ${y})`)

    /* Server side should validate this ?
    const validation = validateTile(x, y)
    if (!validation.valid) {
        console.warn(`Remote bomb at invalid position: ${validation.reason}`)
    }*/
    
    // Track this bomb (with x, y for position tracking)
    trackBomb(playerId, bombId, x, y)
    
    // Render bomb
    renderBomb(bombId, x, y, duration, (explodedBombId, bombX, bombY) => {
        untrackBomb(playerId, explodedBombId, bombX, bombY)
        
        // Render explosion and check for player damage
        renderExplosion(bombX, bombY, 2, (centerX, centerY, affectedTiles) => {
            // Check if local player was hit by remote bomb
            const localPlayer = getLocalPlayer()
            if (localPlayer && localPlayer.alive) {
                const wasHit = affectedTiles.some(tile => 
                    tile.x === localPlayer.x && tile.y === localPlayer.y
                )
                
                if (wasHit) {
                    const died = localPlayer.takeDamage()
                    
                    // Update scoreboard hearts
                    import('../ui/scoreboard.js').then(({ updatePlayerStats }) => {
                        updatePlayerStats(localPlayer.id, { lives: localPlayer.lives })
                    })
                    
                    // Notify server
                    if (socket) {
                        socket.emit('player:damage', {
                            playerId: localPlayer.id,
                            lives: localPlayer.lives,
                            died: died
                        })
                    }
                }
            }
        })
    })
}

/**
 * Handle server-authoritative bomb explosion (e.g., chain reactions).
 * This removes the bomb locally and renders the explosion without applying client-side damage
 * (server already applies damage).
 */
export function handleServerBombExplosion({ bombId, playerId, x, y }) {
    // Remove local tracking so movement is not blocked after explosion
    untrackBomb(playerId, bombId, x, y)

    // Remove bomb element if it exists
    removeBomb(bombId)

    // Render explosion visuals only (no local damage application)
    renderExplosion(x, y, 2)
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