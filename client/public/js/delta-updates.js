/**
 * Delta Update Handler
 * Handles delta updates from server to reduce network payload size
 */

let cachedGameState = null;

/**
 * Apply delta update to cached game state
 * @param {Object} delta - Delta update from server
 * @returns {Object} Complete game state after applying delta
 */
function applyDeltaUpdate(delta) {
  // If delta is a full state update, replace cached state
  if (delta.full) {
    cachedGameState = {
      players: delta.players || [],
      bombs: delta.bombs || [],
      powerups: delta.powerups || [],
      board: delta.board || null,
      gameMode: delta.gameMode || 'multiplayer',
      isRunning: delta.isRunning !== undefined ? delta.isRunning : true,
      isPaused: delta.isPaused !== undefined ? delta.isPaused : false
    };
    return cachedGameState;
  }

  // Initialize cached state if it doesn't exist
  if (!cachedGameState) {
    cachedGameState = {
      players: [],
      bombs: [],
      powerups: [],
      board: null,
      gameMode: 'multiplayer',
      isRunning: true,
      isPaused: false
    };
  }

  // Apply player changes
  if (delta.players) {
    const playersMap = new Map();
    cachedGameState.players.forEach(p => playersMap.set(p.id, p));

    delta.players.forEach(change => {
      if (change._action === 'add' || change._action === 'update') {
        const playerData = { ...change };
        delete playerData._action;
        playersMap.set(change.id, playerData);
      } else if (change._action === 'remove') {
        playersMap.delete(change.id);
      }
    });

    cachedGameState.players = Array.from(playersMap.values());
  }

  // Apply bomb changes
  if (delta.bombs) {
    const bombsMap = new Map();
    cachedGameState.bombs.forEach(b => bombsMap.set(b.id, b));

    // Add new bombs
    if (delta.bombs.added) {
      delta.bombs.added.forEach(bomb => {
        bombsMap.set(bomb.id, bomb);
      });
    }

    // Remove bombs
    if (delta.bombs.removed) {
      delta.bombs.removed.forEach(bombId => {
        bombsMap.delete(bombId);
      });
    }

    cachedGameState.bombs = Array.from(bombsMap.values());
  }

  // Apply powerup changes
  if (delta.powerups) {
    const powerupsMap = new Map();
    cachedGameState.powerups.forEach(p => powerupsMap.set(p.id, p));

    // Add new powerups
    if (delta.powerups.added) {
      delta.powerups.added.forEach(powerup => {
        powerupsMap.set(powerup.id, powerup);
      });
    }

    // Remove powerups
    if (delta.powerups.removed) {
      delta.powerups.removed.forEach(powerupId => {
        powerupsMap.delete(powerupId);
      });
    }

    cachedGameState.powerups = Array.from(powerupsMap.values());
  }

  // Apply board changes
  if (delta.board) {
    if (Array.isArray(delta.board) && delta.board.length > 0 && delta.board[0].x !== undefined) {
      // Delta board (array of tile changes)
      if (!cachedGameState.board) {
        cachedGameState.board = [];
      }

      delta.board.forEach(change => {
        if (!cachedGameState.board[change.x]) {
          cachedGameState.board[change.x] = [];
        }
        cachedGameState.board[change.x][change.y] = change.value;
      });
    } else {
      // Full board
      cachedGameState.board = delta.board;
    }
  }

  // Apply other state properties
  if (delta.gameMode !== undefined) {
    cachedGameState.gameMode = delta.gameMode;
  }

  if (delta.isRunning !== undefined) {
    cachedGameState.isRunning = delta.isRunning;
  }

  if (delta.isPaused !== undefined) {
    cachedGameState.isPaused = delta.isPaused;
  }

  return cachedGameState;
}

/**
 * Reset cached game state (call when game starts/ends)
 */
function resetCachedGameState() {
  cachedGameState = null;
}

/**
 * Get current cached game state
 * @returns {Object|null} Cached game state or null
 */
function getCachedGameState() {
  return cachedGameState;
}
