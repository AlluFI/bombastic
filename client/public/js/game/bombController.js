import { renderBomb, removeBomb } from "../render/bombRender.js";
import { socket } from "../main.js";
import { map } from "../grid.js";

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

function untrackBomb(playerId, bombId, x, y) {
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

    trackBomb(player.id, bombId)
    
    // Render bomb locally
    renderBomb(bombId, x, y, BOMB_DURATION, (explodedBombId, bombX, bombY) => {
        // When bomb explodes
        console.log(`Bomb ${explodedBombId} exploded at (${bombX}, ${bombY})`)
        
        // Untrack the bomb
        untrackBomb(player.id, explodedBombId)
        
        // TODO: Trigger explosion rendering && Check for damage to players/blocks
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
    
    // Track this bomb
    trackBomb(playerId, bombId)
    
    // Render bomb
    renderBomb(bombId, x, y, duration, (explodedBombId) => {
        // When bomb explodes
        untrackBomb(playerId, explodedBombId)
        
        // TODO: Trigger explosion rendering
    })
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