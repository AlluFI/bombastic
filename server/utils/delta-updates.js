/**
 * Delta Update Utilities
 * Calculates and applies delta updates to reduce network payload size
 */

/**
 * Calculate delta between two game states
 * Returns only the changed data instead of full state
 * @param {Object} previousState - Previous game state
 * @param {Object} currentState - Current game state
 * @returns {Object} Delta update object
 */
function calculateDelta(previousState, currentState) {
  if (!previousState) {
    // No previous state - return full state
    return {
      full: true,
      ...currentState
    }
  }

  const delta = {
    full: false,
    timestamp: Date.now()
  }

  // Compare players - only include changed players
  if (currentState.players) {
    const changedPlayers = []
    const previousPlayersMap = new Map()
    
    if (previousState.players) {
      previousState.players.forEach(p => {
        previousPlayersMap.set(p.id, p)
      })
    }

    currentState.players.forEach(currentPlayer => {
      const previousPlayer = previousPlayersMap.get(currentPlayer.id)
      
      if (!previousPlayer) {
        // New player
        changedPlayers.push({ ...currentPlayer, _action: 'add' })
      } else {
        // Check if player changed
        if (
          previousPlayer.x !== currentPlayer.x ||
          previousPlayer.y !== currentPlayer.y ||
          previousPlayer.lives !== currentPlayer.lives ||
          previousPlayer.alive !== currentPlayer.alive ||
          previousPlayer.score !== currentPlayer.score ||
          previousPlayer.bombRange !== currentPlayer.bombRange ||
          previousPlayer.maxBombs !== currentPlayer.maxBombs ||
          previousPlayer.immortal !== currentPlayer.immortal
        ) {
          changedPlayers.push({ ...currentPlayer, _action: 'update' })
        }
      }
    })

    // Check for removed players
    if (previousState.players) {
      previousState.players.forEach(prevPlayer => {
        const stillExists = currentState.players.some(p => p.id === prevPlayer.id)
        if (!stillExists) {
          changedPlayers.push({ id: prevPlayer.id, _action: 'remove' })
        }
      })
    }

    if (changedPlayers.length > 0) {
      delta.players = changedPlayers
    }
  }

  // Compare bombs - only include new/removed bombs
  if (currentState.bombs || previousState.bombs) {
    const currentBombsMap = new Map()
    const previousBombsMap = new Map()

    if (currentState.bombs) {
      currentState.bombs.forEach(b => currentBombsMap.set(b.id, b))
    }
    if (previousState.bombs) {
      previousState.bombs.forEach(b => previousBombsMap.set(b.id, b))
    }

    const bombChanges = {
      added: [],
      removed: []
    }

    // Find new bombs
    currentBombsMap.forEach((bomb, id) => {
      if (!previousBombsMap.has(id)) {
        bombChanges.added.push(bomb)
      }
    })

    // Find removed bombs
    previousBombsMap.forEach((bomb, id) => {
      if (!currentBombsMap.has(id)) {
        bombChanges.removed.push(id)
      }
    })

    if (bombChanges.added.length > 0 || bombChanges.removed.length > 0) {
      delta.bombs = bombChanges
    }
  }

  // Compare powerups - only include new/removed powerups
  if (currentState.powerups || previousState.powerups) {
    const currentPowerupsMap = new Map()
    const previousPowerupsMap = new Map()

    if (currentState.powerups) {
      currentState.powerups.forEach(p => currentPowerupsMap.set(p.id, p))
    }
    if (previousState.powerups) {
      previousState.powerups.forEach(p => previousPowerupsMap.set(p.id, p))
    }

    const powerupChanges = {
      added: [],
      removed: []
    }

    // Find new powerups
    currentPowerupsMap.forEach((powerup, id) => {
      if (!previousPowerupsMap.has(id)) {
        powerupChanges.added.push(powerup)
      }
    })

    // Find removed powerups
    previousPowerupsMap.forEach((powerup, id) => {
      if (!currentPowerupsMap.has(id)) {
        powerupChanges.removed.push(id)
      }
    })

    if (powerupChanges.added.length > 0 || powerupChanges.removed.length > 0) {
      delta.powerups = powerupChanges
    }
  }

  // Compare board - only include changed tiles
  if (currentState.board && previousState.board) {
    const boardChanges = []
    
    for (let x = 0; x < currentState.board.length; x++) {
      if (!currentState.board[x] || !previousState.board[x]) continue
      
      for (let y = 0; y < currentState.board[x].length; y++) {
        if (currentState.board[x][y] !== previousState.board[x][y]) {
          boardChanges.push({
            x,
            y,
            value: currentState.board[x][y]
          })
        }
      }
    }

    if (boardChanges.length > 0) {
      delta.board = boardChanges
    }
  } else if (currentState.board && !previousState.board) {
    // Board initialized for first time
    delta.board = currentState.board
  }

  // Include other state properties if they changed
  if (currentState.gameMode !== previousState.gameMode) {
    delta.gameMode = currentState.gameMode
  }

  if (currentState.isRunning !== previousState.isRunning) {
    delta.isRunning = currentState.isRunning
  }

  if (currentState.isPaused !== previousState.isPaused) {
    delta.isPaused = currentState.isPaused
  }

  // If delta is empty or too large, send full state
  const deltaSize = JSON.stringify(delta).length
  const fullStateSize = JSON.stringify(currentState).length
  
  // If delta is larger than 80% of full state, send full state instead
  if (deltaSize > fullStateSize * 0.8) {
    return {
      full: true,
      ...currentState
    }
  }

  return delta
}

/**
 * Apply delta update to a previous state to get current state
 * @param {Object} previousState - Previous game state
 * @param {Object} delta - Delta update
 * @returns {Object} Updated game state
 */
function applyDelta(previousState, delta) {
  if (delta.full) {
    // Full state update
    return { ...delta }
  }

  const newState = {
    ...previousState
  }

  // Apply player changes
  if (delta.players) {
    if (!newState.players) {
      newState.players = []
    }

    const playersMap = new Map()
    newState.players.forEach(p => playersMap.set(p.id, p))

    delta.players.forEach(change => {
      if (change._action === 'add' || change._action === 'update') {
        const playerData = { ...change }
        delete playerData._action
        playersMap.set(change.id, playerData)
      } else if (change._action === 'remove') {
        playersMap.delete(change.id)
      }
    })

    newState.players = Array.from(playersMap.values())
  }

  // Apply bomb changes
  if (delta.bombs) {
    if (!newState.bombs) {
      newState.bombs = []
    }

    const bombsMap = new Map()
    newState.bombs.forEach(b => bombsMap.set(b.id, b))

    // Add new bombs
    if (delta.bombs.added) {
      delta.bombs.added.forEach(bomb => {
        bombsMap.set(bomb.id, bomb)
      })
    }

    // Remove bombs
    if (delta.bombs.removed) {
      delta.bombs.removed.forEach(bombId => {
        bombsMap.delete(bombId)
      })
    }

    newState.bombs = Array.from(bombsMap.values())
  }

  // Apply powerup changes
  if (delta.powerups) {
    if (!newState.powerups) {
      newState.powerups = []
    }

    const powerupsMap = new Map()
    newState.powerups.forEach(p => powerupsMap.set(p.id, p))

    // Add new powerups
    if (delta.powerups.added) {
      delta.powerups.added.forEach(powerup => {
        powerupsMap.set(powerup.id, powerup)
      })
    }

    // Remove powerups
    if (delta.powerups.removed) {
      delta.powerups.removed.forEach(powerupId => {
        powerupsMap.delete(powerupId)
      })
    }

    newState.powerups = Array.from(powerupsMap.values())
  }

  // Apply board changes
  if (delta.board) {
    if (Array.isArray(delta.board) && delta.board.length > 0 && delta.board[0].x !== undefined) {
      // Delta board (array of changes)
      if (!newState.board) {
        newState.board = []
      }

      delta.board.forEach(change => {
        if (!newState.board[change.x]) {
          newState.board[change.x] = []
        }
        newState.board[change.x][change.y] = change.value
      })
    } else {
      // Full board
      newState.board = delta.board
    }
  }

  // Apply other state properties
  if (delta.gameMode !== undefined) {
    newState.gameMode = delta.gameMode
  }

  if (delta.isRunning !== undefined) {
    newState.isRunning = delta.isRunning
  }

  if (delta.isPaused !== undefined) {
    newState.isPaused = delta.isPaused
  }

  return newState
}

module.exports = {
  calculateDelta,
  applyDelta
}
