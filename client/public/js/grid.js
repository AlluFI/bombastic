// Server coordinates: x = row (vertical), y = col (horizontal)

const GRID_COLS = 15
const GRID_ROWS = 13

const gridElement = document.getElementById('grid')

export let map = []

function generateMap() {
    for (let r = 0; r < GRID_ROWS; r++) {
        map[r] = []
        for (let c = 0; c < GRID_COLS; c++) {
            //border walls -> syle solid
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
}
generateMap()

//empty spawn zones - Players need free space in corners to start the game
const spawns = [
    [1,1],
    [1, GRID_COLS-2],
    [GRID_ROWS -2, 1],
    [GRID_ROWS-2, GRID_COLS-2]
]

//make imediate tiles after corners empty allowing players space to intiate the game
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

//render map to DOM
function renderMap() {
    gridElement.style.width = `${GRID_COLS * 40}px`
    gridElement.style.height = `${GRID_ROWS * 40}px`
    gridElement.style.display = 'grid'
    gridElement.style.gridTemplateColumns = `repeat(${GRID_COLS}, 40px)`
    gridElement.innerHTML = ''

    for (let r = 0; r < GRID_ROWS; r++) {
        for(let c = 0; c < GRID_COLS; c++) {
            const tile = document.createElement('div')
            tile.id = `tile-${r}-${c}`
            tile.classList.add('tile', map[r][c])
            tile.dataset.row = r
            tile.dataset.col = c

            gridElement.appendChild(tile)
        }
    }
}

renderMap()

