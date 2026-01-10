const scoreboardElement = document.getElementById('scoreboard')

let localPlayerId = null

function createPlayerEntryHTML(playerData, isLocal = false) {
    const {name, id, color, lives = 3, isNPC = false, alive = true} = playerData

    // Show gray hearts (💔) if player is dead, red hearts (❤️) if alive
    const heartSymbol = (lives <= 0 || !alive) ? '🖤' : '❤️'
    const heartsHTML = heartSymbol.repeat(Math.max(lives, 0))

    const youLabel = isLocal ? '<span class="you-label">(You)</span>' : ''
    const botLabel = isNPC ? '<span class="bot-label">(Bot)</span>' : ''

    return `
        <div class="player-entry ${isLocal ? 'local-player' : ''} ${isNPC ? 'npc-player' : ''}" data-player-id="${id}">
            <div class="player-info">
                <span class="player-color-indicator" style="background-color: ${color}"></span>
                <span class="player-name">${name}</span>
                ${youLabel}
                ${botLabel}
            </div>
            <div class="player-stats">
                <span class="player-lives">${heartsHTML}</span>
            </div>
        </div>
    `
}

export function renderScoreboard(players, localId) {
    console.log('Rendering scoreboard for ', players.length, 'players')

    localPlayerId = localId

    scoreboardElement.innerHTML = ''

    const title = document.createElement('h3')
    title.textContent = 'PLAYERS'
    title.className = 'scoreboard-title'
    scoreboardElement.appendChild(title)

    const playersContainer = document.createElement('div')
    playersContainer.className = 'players-container'

    players.forEach(player => {
        const isLocal = player.id === localId
        const playerHTML = createPlayerEntryHTML(player, isLocal)
        playersContainer.innerHTML += playerHTML
    })

    scoreboardElement.appendChild(playersContainer)
}

export function addPlayerToScoreboard(playerData) {
    console.log('Adding player to scorboards: ', playerData.name)

    const playerContainer = scoreboardElement.querySelector('.player-container')
    if(!playerContainer) {
        console.error('Player container not found')
        return
    }

    const existingEntry = playerContainer.querySelector(`[data-player-id="${playerData.id}"]`)
    if (existingEntry) {
        console.log('Player already in scroeboard')
        return
    }

    const isLocal = playerData.id === localPlayerId
    const playerHTML = createPlayerEntryHTML(playerData, isLocal)
    playerContainer.innerHTML += playerHTML
}

export function removePlayerFromScoreboard(playerId) {
    console.log('Removing player from scoreboard: ', playerId)

    const playerEntry = scoreboardElement.querySelector(`[data-player-id="${playerId}"]`)

    if (playerEntry) {
        playerEntry.style.opacity = '0'
        playerEntry.style.transition = 'opacity 0.3s'

        setTimeout(() => {
            playerEntry.remove()
        }, 300);
    } else {
        console.log('Player entry not found')
    }
}

export function updatePlayerStats(playerId, stats) {
    const playerEntry = scoreboardElement.querySelector(`[data-player-id="${playerId}"]`)
    if (!playerEntry) {
        console.log('Player ', playerId, ' not found in the scorebord')
        return
    }

    if (stats.lives !== undefined || stats.alive !== undefined) {
        const livesElement = playerEntry.querySelector('.player-lives')
        if (livesElement) {
            // Get lives from stats, or keep current if not provided
            const currentLives = livesElement.textContent.match(/[❤️🖤]/g)?.length || 0
            const lives = stats.lives !== undefined ? stats.lives : currentLives
            
            // Determine if player is alive
            // If alive is explicitly set, use it; otherwise check if lives > 0
            const isAlive = stats.alive !== undefined ? stats.alive : (lives > 0)
            
            // Show gray hearts (🖤) if player is dead, red hearts (❤️) if alive
            const heartSymbol = (lives <= 0 || !isAlive) ? '🖤' : '❤️'
            livesElement.textContent = heartSymbol.repeat(Math.max(lives, 0))
            
            // Add/remove dead class for styling
            if (lives <= 0 || !isAlive) {
                playerEntry.classList.add('player-dead')
            } else {
                playerEntry.classList.remove('player-dead')
            }
        }
    }
 }

 export function initializeScoreboard() {
    console.log('Scoreboard initialised')

    scoreboardElement.innerHTML = '<p class="no-player">Waiting for players...</p>'
 }