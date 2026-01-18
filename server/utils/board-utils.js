/**
 * Board Generation and Explosion Calculation Utilities
 * Functions for generating game boards and calculating explosion effects
 */

const CONSTANTS = require('../constants.js')

// Grid dimensions (matching client)
const GRID_ROWS = CONSTANTS.GRID_ROWS
const GRID_COLS = CONSTANTS.GRID_COLS

/**
 * Generates the game board
 * Returns 2D array where: 0 = walkable, 1 = destructible block, 2 = indestructible wall
 * This matches the client's board generation logic exactly
 */
function generateBoard() {
  const board = []
  
  // Initialize board
  for (let r = 0; r < GRID_ROWS; r++) {
    board[r] = []
    for (let c = 0; c < GRID_COLS; c++) {
      // Border walls -> 2 (indestructible wall)
      if (r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) {
        board[r][c] = 2
        continue
      }
      
      // Internal unbreakable blocks (checkerboard pattern) -> 2 (indestructible wall)
      if (r % 2 === 0 && c % 2 === 0) {
        board[r][c] = 2
        continue
      }
      
      // Default to destructible block -> 1
      board[r][c] = 1
    }
  }
  
  // Empty spawn zones - Players need free space in corners to start the game
  const spawns = [
    [1, 1],
    [1, GRID_COLS - 2],
    [GRID_ROWS - 2, 1],
    [GRID_ROWS - 2, GRID_COLS - 2]
  ]
  
  // Make immediate tiles after corners empty (walkable)
  for (const [r, c] of spawns) {
    board[r][c] = 0 // Make spawn position walkable
    // Make adjacent tiles walkable for initial movement
    if (board[r][c + 1] !== undefined) {
      if (c + 1 === GRID_COLS - 1) {
        board[r][c - 1] = 0
      } else {
        board[r][c + 1] = 0
      }
    }
    if (board[r + 1] && board[r + 1][c] !== undefined) {
      if (r + 1 === GRID_ROWS - 1) {
        board[r - 1][c] = 0
      } else {
        board[r + 1][c] = 0
      }
    }
  }
  
  return board
}

/**
 * Calculates which blocks are destroyed by a bomb explosion
 * @param {Object} bomb - Bomb object { x, y, range }
 * @param {Array<Array<number>>} board - Game board (0=walkable, 1=destructible, 2=indestructible)
 * @returns {Array<Object>} Array of destroyed block positions { x, y }
 */
function calculateExplosionBlocks(bomb, board) {
  const destroyedBlocks = []
  const range = bomb.range || 2
  
  // Calculate explosion in 4 directions (matching DangerDetector logic)
  const directions = [
    { x: -1, y: 0 },  // UP (decrease row)
    { x: 1, y: 0 },   // DOWN (increase row)
    { x: 0, y: -1 },  // LEFT (decrease col)
    { x: 0, y: 1 },   // RIGHT (increase col)
  ]
  
  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const checkX = bomb.x + dir.x * i
      const checkY = bomb.y + dir.y * i
      
      // Stop if out of bounds
      if (checkX < 0 || checkX >= 13 || checkY < 0 || checkY >= 15) {
        break
      }
      
      // Check if position has a destructible block
      if (board[checkX] && board[checkX][checkY] === 1) { // 1 = destructible block
        destroyedBlocks.push({ x: checkX, y: checkY })
        break // Explosion stops at destructible blocks
      }
      
      // Stop if hit an indestructible wall (explosion doesn't pass through)
      if (board[checkX] && board[checkX][checkY] === 2) { // 2 = indestructible wall
        break
      }
    }
  })
  
  return destroyedBlocks
}

/**
 * Calculates all tiles affected by a bomb explosion (for damage detection)
 * @param {Object} bomb - Bomb object { x, y, range }
 * @param {Array<Array<number>>} board - Game board (0=walkable, 1=destructible, 2=indestructible)
 * @returns {Array<Object>} Array of explosion tile positions { x, y }
 */
function calculateExplosionTiles(bomb, board) {
  const explosionTiles = []
  const range = bomb.range || 2
  
  // Add bomb center position
  explosionTiles.push({ x: bomb.x, y: bomb.y })
  
  // Calculate explosion in 4 directions (matching DangerDetector logic)
  const directions = [
    { x: -1, y: 0 },  // UP (decrease row)
    { x: 1, y: 0 },   // DOWN (increase row)
    { x: 0, y: -1 },  // LEFT (decrease col)
    { x: 0, y: 1 },   // RIGHT (increase col)
  ]
  
  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const checkX = bomb.x + dir.x * i
      const checkY = bomb.y + dir.y * i
      
      // Stop if out of bounds
      if (checkX < 0 || checkX >= 13 || checkY < 0 || checkY >= 15) {
        break
      }
      
      // Add this tile to explosion (even if it has a block - explosion reaches it)
      explosionTiles.push({ x: checkX, y: checkY })
      
      // Stop if hit an indestructible wall (explosion doesn't pass through)
      if (board[checkX] && board[checkX][checkY] === 2) { // 2 = indestructible wall
        break
      }
      
      // Stop if hit a destructible block (explosion stops at block, but block is included)
      if (board[checkX] && board[checkX][checkY] === 1) { // 1 = destructible block
        break // Explosion stops at destructible blocks
      }
    }
  })
  
  return explosionTiles
}

module.exports = {
  generateBoard,
  calculateExplosionBlocks,
  calculateExplosionTiles
}
