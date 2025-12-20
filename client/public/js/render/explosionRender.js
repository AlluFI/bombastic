import { map } from '../grid.js'

const EXPLOSION_DURATION = 500
const DEFAULT_EXPLOTION_RANGE = 2

const DIRECTIONS = {
    up : {dx: -1, dy: 0},
    down: {dx: 1, dy: 0},
    left: {dx: 0, dy: -1},
    right: {dx: 0, dy: -1}
}

function getTilePosition(x, y) {
    const tile = document.getElementById(`tile-${x}-${y}`)

    if (!tile) {
        console.log(`Tile not found at ${x}-${y}`)
        return null
    }

    const tileRect = tile.getBoundingClientRect()

    return {
        left: tileRect.left,
        top: tileRect.top
    }
}

function createExplosionElement(x, y, type = 'center', direction = null) {
    const position = getTilePosition(x, y)
    if (!position) return null

    const explosionElement = document.createElement('div')
    explosionElement.className = `explosion ${type}`

    if (type === 'arm' && direction) {
        explosionElement.classList.add(direction)
    }

    explosionElement.style.left = `${position.left}px`
    explosionElement.style.top = `${position.top}px`

    explosionElement.dataset.x = x
    explosionElement.dataset.y = y

    return explosionElement
}

function calculateExplosionTiles(centerX, centerY, range = DEFAULT_EXPLOSION_RANGE) {
    const explosionTiles = []
    
    // Add center explosion
    explosionTiles.push({
        x: centerX,
        y: centerY,
        type: 'center',
        direction: null
    })
    
    // Expand in 4 directions
    const directions = [
        { name: 'up', dx: -1, dy: 0, orientation: 'vertical' },
        { name: 'down', dx: 1, dy: 0, orientation: 'vertical' },
        { name: 'left', dx: 0, dy: -1, orientation: 'horizontal' },
        { name: 'right', dx: 0, dy: 1, orientation: 'horizontal' }
    ]
    
    directions.forEach(dir => {
        // Expand from 1 to range in this direction
        for (let i = 1; i <= range; i++) {
            const x = centerX + (dir.dx * i)
            const y = centerY + (dir.dy * i)
            
            // Check if position is valid
            if (!map[x] || map[x][y] === undefined) {
                break  // Out of bounds, stop expanding
            }
            
            const tileType = map[x][y]
            
            // Stop at solid walls
            if (tileType === 'solid') {
                break  // Solid wall blocks explosion
            }
            
            // Determine explosion type
            const isLastTile = (i === range)
            const isTip = isLastTile || tileType === 'breakable'
            
            explosionTiles.push({
                x: x,
                y: y,
                type: isTip ? 'tip' : 'arm',
                direction: dir.orientation
            })
            
            // Stop at breakable blocks (but include them in explosion)
            if (tileType === 'breakable') {
                // TODO: Later, destroy this block
                break
            }
        }
    })
    
    return explosionTiles
}

export function renderExplosion(centerX, centerY, range = DEFAULT_EXPLOSION_RANGE, onComplete = null) {
    console.log(`Rendering explosion at (${centerX}, ${centerY}) with range ${range}`)
    
    // Calculate which tiles should explode
    const explosionTiles = calculateExplosionTiles(centerX, centerY, range)
    
    console.log(`Explosion affects ${explosionTiles.length} tiles`)
    
    // Create explosion elements
    const explosionElements = []
    const grid = document.getElementById('grid')
    
    explosionTiles.forEach(tile => {
        const element = createExplosionElement(tile.x, tile.y, tile.type, tile.direction)
        if (element) {
            grid.appendChild(element)
            explosionElements.push(element)
        }
    })
    
    // Remove explosion after duration
    setTimeout(() => {
        explosionElements.forEach(element => {
            if (element.parentNode) {
                element.remove()
            }
        })
        
        console.log(`Explosion at (${centerX}, ${centerY}) cleared`)
        
        // Call completion callback
        if (onComplete) {
            onComplete(centerX, centerY, explosionTiles)
        }
    }, EXPLOSION_DURATION)
    
    // Return explosion data for damage checking (later)
    return {
        centerX,
        centerY,
        range,
        tiles: explosionTiles,
        elements: explosionElements
    }
}


export function isInExplosion(x, y, explosionTiles) {
    return explosionTiles.some(tile => tile.x === x && tile.y === y)
}

export function getExplosionPositions(centerX, centerY, range = DEFAULT_EXPLOSION_RANGE) {
    const tiles = calculateExplosionTiles(centerX, centerY, range)
    return tiles.map(tile => ({ x: tile.x, y: tile.y }))
}