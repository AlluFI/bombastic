const BOMB_DURATION = 3000
const WARNING_TIME = 2000
const CRITICAL_TIME = 1000

const activeBombs = new Map()

function getTilePosition(x, y) {
    const tile = document.getElementById(`tile-${x}-${y}`)

    if (!tile) {
        console.error(`Tile not found tile-${x}-${y}`)
        return {left:0, top:0}
    }
    const tileRect = tile.getBoundingClientRect()

    return {left: tileRect.left, top: tileRect.top}
}

function createBombElement(bombId, x, y, timer = 3) {
    //bomb div
    const bombElement = document.createElement('div')
    bombElement.classList = 'bomb placing'
    bombElement.id = `bomb-${bombId}`
    bombElement.dataset.bombId = bombId
    bombElement.dataset.x = x
    bombElement.dataset.y = y

    //bomb timer
    const timerElement = document.createElement('span')
    timerElement.className = 'bomb-timer'
    timerElement.textContent = timer

    bombElement.appendChild(timerElement)

    const position = getTilePosition(x,y)
    bombElement.style.left = `${position.left + 5}px`
    bombElement.style.top = `${position.top + 5}px`

    return bombElement
}

function updateBombTimer(bombElement, seconds) {
    const timerElement = bombElement.querySelector('.bomb-timer')
    if (timerElement) {
        timerElement.textContent = seconds
    }
}

function setBombState(bombElement, state) {
    bombElement.classList.remove('placing', 'warning', 'critical')

    if(state === 'warning') {
        bombElement.classList.add('warning')
    } else if (state === 'critical') {
        bombElement.classList.add('critical')
    }
}

export function renderBomb(bombId, x, y, duration = BOMB_DURATION, onExplode = null) {
    // Check if bomb already exists (by ID)
    if (activeBombs.has(bombId)) {
        return
    }
    
    // Check if bomb already exists at this position (by position)
    // This prevents multiple bombs from being rendered at the same position
    // Even if they have different IDs (race condition protection)
    for (const [existingBombId, bombData] of activeBombs.entries()) {
        if (bombData && bombData.element && bombData.element.dataset) {
            const existingX = parseInt(bombData.element.dataset.x)
            const existingY = parseInt(bombData.element.dataset.y)
            if (!isNaN(existingX) && !isNaN(existingY) && existingX === x && existingY === y) {
                return
            }
        }
    }

    const bombElement = createBombElement(bombId, x, y, Math.ceil(duration / 1000))

    const grid = document.getElementById('grid')
    grid.appendChild(bombElement)

    const placingTimeout = setTimeout(() => {
        bombElement.classList.remove('placing')
    }, 300)

    const countdownTimeouts = []

    for(let i = 1; i <= 3; i++) {
        const timeoutId = setTimeout(() => {
            const secondsLeft = Math.ceil((duration - (i * 1000)) / 1000)
            updateBombTimer(bombElement, secondsLeft)
        }, i * 1000);

        countdownTimeouts.push(timeoutId)
    }

    const warningTimeout = setTimeout(() => {
        setBombState(bombElement, 'warning')
    }, duration - WARNING_TIME)

    const criticalTimeout = setTimeout(() => {
        setBombState(bombElement, 'critical')
    }, duration - CRITICAL_TIME)

    const explodeTimeout = setTimeout(() => {
        bombElement.classList.add('exploding')
        if (onExplode) {
            onExplode(bombId, x, y)
        }
        setTimeout(() => {
            removeBomb(bombId)
        }, 300);
    }, duration);

    activeBombs.set(bombId, {
        element: bombElement,
        timeouts: [
            placingTimeout,
            ...countdownTimeouts,
            warningTimeout,
            criticalTimeout,
            explodeTimeout
        ]
    })
}

export function removeBomb(bombId) {
    const bombData = activeBombs.get(bombId)

    if (!bombData) {
        return
    }

    bombData.timeouts.forEach(timeOut => {
        clearTimeout(timeOut)
    });

    if (bombData.element && bombData.element.parentNode) {
        bombData.element.remove()
    }

    activeBombs.delete(bombId)
}

export function getBombPosition(bombId) {
    const bombData = activeBombs.get(bombId)

    if (!bombData || !bombData.element) {
        return null
    }

    return {
        x: parseInt(bombData.element.dataset.x),
        y: parseInt(bombData.element.dataset.y)
    }
}

export function removeAllBombs() {
    activeBombs.forEach((_, bombId) => {
        removeBomb(bombId)
    })
}

export function getActiveBombsCount() {
    return activeBombs.size
}