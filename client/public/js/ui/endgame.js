// Enhanced endgame screen functionality

/**
 * Render the enhanced endgame screen with winner and final scores
 * @param {Object} data - Game end data { winner, isDraw, players }
 * @param {string} localPlayerId - ID of the local player
 */
export function renderEndScreen(data, localPlayerId) {
    const winnerTitle = document.getElementById('winner-title')
    const winnerName = document.getElementById('winner-name')
    const finalScoreboardList = document.getElementById('final-scoreboard-list')
    
    if (!winnerTitle || !winnerName || !finalScoreboardList) {
        console.error('End screen elements not found')
        return
    }
    
    // Clear previous content
    winnerName.textContent = ''
    finalScoreboardList.innerHTML = ''
    
    // Set title
    if (data.isDraw) {
        winnerTitle.textContent = 'Draw!'
        winnerName.textContent = 'All players eliminated'
    } else if (data.winner) {
        winnerTitle.textContent = 'Winner!'
        const winnerDisplayName = data.winner.isNPC ? `${data.winner.name} (Bot)` : data.winner.name
        winnerName.textContent = winnerDisplayName
    } else {
        winnerTitle.textContent = 'Game Over'
        winnerName.textContent = ''
    }
    
    // Render final scoreboard (sorted by elimination order - winner first)
    if (data.players && data.players.length > 0) {
        // Players are already sorted by elimination order (winner first) from server
        data.players.forEach((player, index) => {
            const isWinner = data.winner && player.id === data.winner.id
            const isLocal = player.id === localPlayerId
            
            // Calculate rank (1st place = winner, 2nd place = second-to-last eliminated, etc.)
            const rank = index + 1
            
            const entry = document.createElement('div')
            entry.className = `final-player-entry ${isWinner ? 'winner' : ''}`
            
            const playerName = player.isNPC ? `${player.name} (Bot)` : player.name
            const youLabel = isLocal ? ' <span style="color: #00bfff;">(You)</span>' : ''
            
            // Format rank with ordinal suffix (1st, 2nd, 3rd, 4th)
            const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
            const rankDisplay = `${rank}${rankSuffix}`
            
            entry.innerHTML = `
                <div class="player-name-end">
                    <span class="player-color-indicator" style="background-color: ${player.color || '#888'}"></span>
                    ${playerName}${youLabel}
                </div>
                <div class="player-score-end">${rankDisplay}</div>
            `
            
            finalScoreboardList.appendChild(entry)
        })
    }
}

