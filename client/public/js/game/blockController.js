// Handles breakable block destruction
import { map } from '../grid.js'
import { socket } from '../main.js'

const DESTRUCTION_ANIMATION_DURATION = 300  // 300ms

// Track destroyed blocks to prevent duplicate destruction
const destroyedBlocks = new Map()

//destroy single block
export function destroyBlock(x, y, emitToServer = true) {
    // Validate position
    if (!map[x] || map[x][y] === undefined) {
        console.warn(`Invalid position for block destruction: (${x}, ${y})`)
        return false
    }
    
    // Check if tile is breakable
    if (map[x][y] !== 'breakable') {
        console.log(`Tile at (${x}, ${y}) is not breakable (type: ${map[x][y]})`)
        return false
    }
    
    // Check if already destroyed
    const posKey = `${x}-${y}`
    if (destroyedBlocks.has(posKey)) {
        console.log(`Block at (${x}, ${y}) already destroyed`)
        return false
    }
    
    console.log(`Destroying block at (${x}, ${y})`)
    
    // Mark as destroyed
    destroyedBlocks.set(posKey, Date.now())
    
    // Get the tile element
    const tileElement = document.getElementById(`tile-${x}-${y}`)
    
    if (tileElement) {
        // Add destruction animation
        tileElement.classList.add('destroying')
        
        // Remove tile after animation
        setTimeout(() => {
            // Update map data
            map[x][y] = 'empty'
            
            // Update tile appearance
            tileElement.classList.remove('breakable', 'destroying')
            tileElement.classList.add('empty')
            
            console.log(`Block at (${x}, ${y}) destroyed - tile now empty`)
            
            
        }, DESTRUCTION_ANIMATION_DURATION)
    } else {
        console.error(`Tile element not found: tile-${x}-${y}`)
        
        // Still update map even if element not found
        map[x][y] = 'empty'
    }
    
    // Broadcast to server if requested
    if (emitToServer && socket) {
        socket.emit('block:destroy', {
            x: x,
            y: y,
            timestamp: Date.now()
        })
    }
    
    return true
}

//destroy multiple blocks
export function destroyBlocksInTiles(tiles) {
    const destroyedPositions = []
    
    tiles.forEach(tile => {
        const destroyed = destroyBlock(tile.x, tile.y, false)  //emit in batches to reduce traffic
        if (destroyed) {
            destroyedPositions.push({ x: tile.x, y: tile.y })
        }
    })
    
    // Emit all destroyed blocks in one message
    if (destroyedPositions.length > 0 && socket) {
        socket.emit('blocks:destroy', {
            blocks: destroyedPositions,
            timestamp: Date.now()
        })
    }
    
    console.log(`Destroyed ${destroyedPositions.length} blocks`)
    
    return destroyedPositions
}

//handle remote block destruction
export function destroyBlockRemote(x, y) {
    console.log(`Remote block destruction at (${x}, ${y})`)
    
    // Destroy without emitting back to server
    destroyBlock(x, y, false)
}

export function destroyBlocksRemote(blocks) {
    console.log(`Remote block destruction: ${blocks.length} blocks`)
    
    blocks.forEach(block => {
        destroyBlock(block.x, block.y, false)
    })
}

export function isBlockDestroyed(x, y) {
    const posKey = `${x}-${y}`
    return destroyedBlocks.has(posKey)
}

export function getDestroyedBlockCount() {
    return destroyedBlocks.size
}

//Clears destroyed block tracking (for game reset)
export function clearDestroyedBlocks() {
    console.log('Clearing destroyed blocks tracking')
    destroyedBlocks.clear()
}

//Filters tiles to only include breakable blocks
export function filterBreakableBlocks(tiles) {
    return tiles.filter(tile => {
        const tileType = map[tile.x]?.[tile.y]
        return tileType === 'breakable'
    })
}