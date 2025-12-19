import { renderBomb, removeBomb } from "../render/bombRender.js";
import { socket } from "../main.js";

const MAX_BOMBS_PER_PLAYER = 1
const BOMB_DURATION = 3000

//how many active bombs each player has
const playerBombs = new Map()

//Global bomb counter for unique IDs
let bombIdCounter = 0

function generateBombId(playerId) {
    bombIdCounter++
    return `${playerId}-bomb-${bombIdCounter}-${Date.now()}`
}

function getPlayerBombCount(playerId) {
    const bombs = playerBombs.get(playerId)
    return bombs ? bombs.size : 0
}

function trackBomb(playerId, bombId) {
    if (!playerBombs.has(playerId)) {
        playerBombs.set(playerId, new Set())
    }

    playerBombs.get(playerId).add(bombId)
    console.log(`Player ${playerId} now has ${getPlayerBombCount(playerId)} bomb(s)`)
}

function untrackBomb(playerId, bombId) {
    const bombs = playerBombs.get(playerId)
    if (bombs) {
        bombs.delete(bombId)
        console.log(`Player ${playerId} now has ${getPlayerBombCount(playerId)} bomb(s)`)
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
        })
        playerBombs.delete(playerId)
    }
}

export function clearAllBombs() {
    playerBombs.forEach((bombs, playerId) => {
        clearPlayerBombs(playerId)
    })
}