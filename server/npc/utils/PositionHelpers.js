/**
 * Position Helper Utilities
 * Functions for position calculations and validation
 */

/**
 * Gets the next position after moving in a direction
 * @param {Object} pos - Current position { x, y }
 * @param {string} direction - Direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @returns {Object} Next position { x, y }
 */
function getNextPosition(pos, direction) {
  // Coordinate system: x = row (vertical), y = col (horizontal)
  // UP = decrease x (move up in rows), DOWN = increase x (move down in rows)
  // LEFT = decrease y (move left in cols), RIGHT = increase y (move right in cols)
  const moves = {
    'UP': { x: -1, y: 0 },    // Move up = decrease row
    'DOWN': { x: 1, y: 0 },   // Move down = increase row
    'LEFT': { x: 0, y: -1 },  // Move left = decrease col
    'RIGHT': { x: 0, y: 1 },  // Move right = increase col
  }

  const move = moves[direction] || { x: 0, y: 0 }
  return {
    x: pos.x + move.x,
    y: pos.y + move.y,
  }
}

/**
 * Checks if a position is valid (within bounds)
 * @param {Object} pos - Position { x, y }
 * @param {number} maxRows - Maximum rows
 * @param {number} maxCols - Maximum columns
 * @returns {boolean}
 */
function isValidPosition(pos, maxRows, maxCols) {
  // Coordinate system: x = row (0 to maxRows-1), y = col (0 to maxCols-1)
  // Grid is 13 rows (0-12) × 15 cols (0-14)
  return pos.x >= 0 && pos.x < maxRows && pos.y >= 0 && pos.y < maxCols
}

/**
 * Checks if a position is walkable
 * @param {Object} npc - NPC instance
 * @param {Object} pos - Position { x, y }
 * @returns {boolean}
 */
function isWalkable(npc, pos) {
  if (!isValidPosition(pos, npc.maxRows, npc.maxCols)) {
    return false
  }
  
  // Check if there's a bomb at this position (bombs block movement)
  if (npc.gameState && npc.gameState.bombs && npc.gameState.bombs.length > 0) {
    const hasBomb = npc.gameState.bombs.some(bomb => bomb.x === pos.x && bomb.y === pos.y)
    if (hasBomb) {
      return false // Bomb blocks movement
    }
  }
  
  // Note: Players and NPCs can now overlap - no collision check needed
  
  // Prefer navigation grid if available (more efficient, already processed)
  // BUT: Double-check bombs here too (defensive check in case gameState.bombs was stale)
  if (npc.navigationGrid) {
    // Grid is structured as grid[row][col], and x=row, y=col
    // Navigation grid value: 0 = walkable, 1 = blocked (including bombs)
    const gridValue = npc.navigationGrid[pos.x] && npc.navigationGrid[pos.x][pos.y]
    
    // Defensive check: if navigation grid says it's walkable (0), but there's a bomb in gameState, block it
    if (gridValue === 0 && npc.gameState && npc.gameState.bombs && npc.gameState.bombs.length > 0) {
      const hasBomb = npc.gameState.bombs.some(bomb => bomb.x === pos.x && bomb.y === pos.y)
      if (hasBomb) {
        // Navigation grid says walkable but there's a bomb - block it!
        return false
      }
    }
    
    return gridValue === 0
  }
  
  // Fallback: check board directly if navigation grid doesn't exist
  // This handles cases where navigation grid wasn't created but board exists
  if (npc.gameState && npc.gameState.board) {
    // Grid is structured as grid[row][col], and x=row, y=col
    // 0 = walkable, 1 = destructible block, 2 = indestructible wall
    const row = npc.gameState.board[pos.x]
    if (!row) return false
    const cell = row[pos.y]
    // Only walkable if cell is 0 (explicitly walkable), block any blocks or walls
    return cell === 0
  }
  
  // If no board information at all, allow movement as fallback
  // Note: Board is now generated on server, so this should rarely happen
  return true
}

module.exports = {
  getNextPosition,
  isValidPosition,
  isWalkable
}
