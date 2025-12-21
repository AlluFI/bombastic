// Server coordinates: x = row (vertical), y = col (horizontal)

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
 * Falls back to local generation if no server board provided
 * Only renders the grid if it hasn't been rendered yet (to avoid clearing player elements)
 * 
 * IMPORTANT: This preserves locally destroyed blocks when syncing from server
 */
export function initializeMap(serverBoard = null, forceRender = false) {
    if (serverBoard) {
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
    } else {
        // Fallback: generate locally
        generateMap()
        
        // Only render if grid hasn't been rendered yet
        if (!gridRendered || forceRender) {
            renderMap()
            gridRendered = true
        }
    }
}

/**
 * Local map generation (fallback if server doesn't provide board)
 */
function generateMap() {
    for (let r = 0; r < GRID_ROWS; r++) {
        map[r] = []
        for (let c = 0; c < GRID_COLS; c++) {
            //border walls -> style solid
            if (r === 0 || r === GRID_ROWS -1 || c === 0 || c === GRID_COLS -1) {
                map[r][c] = 'solid'
                continue
            }

            //internal unbreakable block -> style solid
            if (r % 2 === 0 && c % 2 === 0) {
                map[r][c] = 'solid'
                continue
            }

            map[r][c] = 'breakable'
        }
    }
    
    //empty spawn zones - Players need free space in corners to start the game
    const spawns = [
        [1,1],
        [1, GRID_COLS-2],
        [GRID_ROWS -2, 1],
        [GRID_ROWS-2, GRID_COLS-2]
    ]

    //make immediate tiles after corners empty allowing players space to initiate the game
    for(const [r, c] of spawns) {
        map[r][c] = 'empty'
        if (map[r][c+1]) {
            if (c+1 === GRID_COLS -1) {
                map[r][c-1] = 'empty'
            } else {
                map[r][c+1] = 'empty'
            }
        }
        if (map[r+1]?.[c]) {
            if (r+1 === GRID_ROWS -1) {
                map[r-1][c] = 'empty'
            } else {
                map[r+1][c] = 'empty'
            }
        }
    }
}

// Initialize with fallback (will be overridden when server sends board)
generateMap()

//render map to DOM
function renderMap() {
    if (!gridElement) {
        console.warn('Grid element not found, cannot render map')
        return
    }
    
    gridElement.style.width = `${GRID_COLS * 40}px`
    gridElement.style.height = `${GRID_ROWS * 40}px`
    gridElement.style.display = 'grid'
    gridElement.style.gridTemplateColumns = `repeat(${GRID_COLS}, 40px)`
    
    // Only clear innerHTML on first render to avoid removing player elements
    if (!gridRendered) {
        gridElement.innerHTML = ''
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

// Initial render
renderMap()

