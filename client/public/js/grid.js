// Server coordinates: x = row (vertical), y = col (horizontal)

// IMPORTANT: These constants must match server/constants.js
// GRID_ROWS = 13, GRID_COLS = 15
const GRID_COLS = 15
const GRID_ROWS = 13

const gridElement = document.getElementById('grid')

export let map = []

/**
 * Converts server board format (0=walkable, 1=block, 2=wall) to client format (strings)
 * @param {Array<Array<number>>} serverBoard - Board from server
 * @returns {Array<Array<string>>} Client board format
 */
function convertServerBoardToClient(serverBoard) {
    if (!serverBoard) return null
    
    return serverBoard.map(row => 
        row.map(cell => {
            // Server: 0 = walkable, 1 = destructible block, 2 = indestructible wall
            // Client: 'empty', 'breakable', 'solid'
            if (cell === 0) return 'empty'
            if (cell === 1) return 'breakable'
            if (cell === 2) return 'solid'
            return 'empty' // Default fallback
        })
    )
}

let gridRendered = false

/**
 * Initializes the map from server board data
 * Server always provides the board, so this is the authoritative source
 * Only renders the grid if it hasn't been rendered yet (to avoid clearing player elements)
 * 
 * IMPORTANT: This preserves locally destroyed blocks when syncing from server
 */
export function initializeMap(serverBoard, forceRender = false) {
    if (!serverBoard) {
        console.error('Server board is required. Cannot initialize map without server board.')
        return
    }
    
    // Convert server board to client format
    const serverMap = convertServerBoardToClient(serverBoard)
    
    // If map already exists, preserve destroyed blocks (empty tiles that were breakable)
    // The server board always has the original state, so we need to merge intelligently
    if (map && map.length > 0 && !forceRender) {
        // Merge: preserve tiles that are currently 'empty' (they might be destroyed blocks)
        // Only update tiles that should be different (but server doesn't change blocks, so this is mostly preserving)
        for (let r = 0; r < serverMap.length && r < map.length; r++) {
            if (!map[r]) map[r] = []
            for (let c = 0; c < serverMap[r].length && c < map[r].length; c++) {
                // If current tile is 'empty' and server says 'breakable', keep it empty
                // (block was destroyed client-side and should stay destroyed)
                if (map[r][c] === 'empty' && serverMap[r][c] === 'breakable') {
                    // Keep the empty state (preserve destroyed block)
                    continue
                }
                // Otherwise, use server's value (for walls, initially empty tiles, etc.)
                // Note: This won't restore destroyed blocks, which is correct
                map[r][c] = serverMap[r][c]
            }
        }
    } else {
        // First time initialization or forced - use server map as-is
        map = serverMap
    }
    
    // Only render if grid hasn't been rendered yet, or if forced
    // This prevents clearing player elements that are already in the DOM
    if (!gridRendered || forceRender) {
        renderMap()
        gridRendered = true
    }
}

// Note: Board generation is handled server-side
// The server always provides the board via the 'game:started' event
// No local fallback needed - server is the single source of truth

/**
 * Calculate responsive tile size based on available space
 */
function getTileSize() {
    const isMobile = window.innerWidth <= 768
    const isSmallMobile = window.innerWidth <= 480
    const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth <= 768
    
    if (isLandscape) {
        // Landscape: use viewport height, account for HUD
        const availableHeight = window.innerHeight - 120 // Account for HUD, controls, padding
        return Math.min(Math.floor(availableHeight / GRID_ROWS), 30)
    } else if (isSmallMobile) {
        // Small mobile portrait: calculate based on available vertical space
        // Account for: instructions (~60px), HUD elements (~200px), mobile controls (~170px), padding (20px)
        const availableHeight = window.innerHeight - 450
        const availableWidth = window.innerWidth - 20 // Account for padding
        // Use the smaller dimension to ensure everything fits
        const heightBased = Math.floor(availableHeight / GRID_ROWS)
        const widthBased = Math.floor(availableWidth / GRID_COLS)
        return Math.min(Math.min(heightBased, widthBased), 24)
    } else if (isMobile) {
        // Mobile portrait: calculate based on available vertical space
        // Account for: instructions (~70px), HUD elements (~250px), mobile controls (~180px), padding (20px)
        const availableHeight = window.innerHeight - 520
        const availableWidth = window.innerWidth - 40 // Account for padding
        // Use the smaller dimension to ensure everything fits
        const heightBased = Math.floor(availableHeight / GRID_ROWS)
        const widthBased = Math.floor(availableWidth / GRID_COLS)
        return Math.min(Math.min(heightBased, widthBased), 30)
    } else {
        // Desktop: default size
        return 40
    }
}

/**
 * Update grid size responsively
 */
function updateGridSize() {
    if (!gridElement) return
    
    const tileSize = getTileSize()
    gridElement.style.width = `${GRID_COLS * tileSize}px`
    gridElement.style.height = `${GRID_ROWS * tileSize}px`
    gridElement.style.display = 'grid'
    gridElement.style.gridTemplateColumns = `repeat(${GRID_COLS}, ${tileSize}px)`
    gridElement.style.gridTemplateRows = `repeat(${GRID_ROWS}, ${tileSize}px)`
}

//render map to DOM
function renderMap() {
    if (!gridElement) {
        console.warn('Grid element not found, cannot render map')
        return
    }
    
    // Update grid size responsively
    updateGridSize()
    
    // Only clear innerHTML on first render to avoid removing player elements
    // But preserve any player elements that might already exist
    if (!gridRendered) {
        // Store player elements before clearing
        const playerElements = Array.from(gridElement.querySelectorAll('.player'))
        gridElement.innerHTML = ''
        // Re-append player elements after clearing
        playerElements.forEach(el => gridElement.appendChild(el))
    }

    for (let r = 0; r < GRID_ROWS; r++) {
        for(let c = 0; c < GRID_COLS; c++) {
            // Check if tile already exists (to preserve player elements on subsequent renders)
            let tile = document.getElementById(`tile-${r}-${c}`)
            
            if (!tile) {
                // Create new tile only if it doesn't exist
                tile = document.createElement('div')
                tile.id = `tile-${r}-${c}`
                tile.dataset.row = r
                tile.dataset.col = c
                gridElement.appendChild(tile)
            }
            
            // Update tile class based on current map state
            tile.className = 'tile ' + (map[r]?.[c] || 'empty')
        }
    }
    
    gridRendered = true
}

// Update grid size on window resize
let resizeTimeout
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
        if (gridRendered) {
            updateGridSize()
        }
    }, 100)
})

// Note: Initial render happens when server sends board via initializeMap()
// No need to render empty map on page load

