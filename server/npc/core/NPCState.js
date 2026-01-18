/**
 * NPC State Management Module
 * 
 * Handles NPC state updates, world state management, and navigation grid updates
 */

const DangerDetector = require('../utils/DangerDetector')
const BehaviorStrategies = require('../BehaviorStrategies')

/**
 * State management methods for NPC class
 * These methods handle updating NPC's internal representation of the game world
 */
class NPCState {
  /**
   * Updates NPC's internal world state representation
   * Called by server when game state changes
   * @param {Object} npc - NPC instance
   * @param {Object} gameState - Current game state from server
   */
  static updateWorldState(npc, gameState) {
    // Update position if provided
    if (gameState.players) {
      const npcPlayer = gameState.players.find(p => p.id === npc.id)
      if (npcPlayer) {
        npc.position = { x: npcPlayer.x, y: npcPlayer.y }
        npc.alive = npcPlayer.alive !== false
        npc.score = npcPlayer.score || 0
        npc.lives = npcPlayer.lives || 3
      }
    }

    // Update grid dimensions if available
    if (gameState.board) {
      npc.maxRows = gameState.board.length
      npc.maxCols = gameState.board[0] ? gameState.board[0].length : 15
    } else {
      // If no board, use default dimensions matching client grid
      // Client grid is 13 rows × 15 cols
      npc.maxRows = 13
      npc.maxCols = 15
    }

    // Update navigation grid (for pathfinding)
    NPCState.updateNavigationGrid(npc, gameState)

    // Track if bombs exploded (bombs removed from gameState)
    const previousBombCount = npc.gameState?.bombs?.length || 0
    const currentBombCount = gameState.bombs?.length || 0
    if (previousBombCount > currentBombCount) {
      // Bombs exploded - update explosion time for cooldown
      npc.lastExplosionTime = Date.now()
    }
    
    // Update danger zones from active bombs using DangerDetector
    if (gameState.bombs && gameState.bombs.length > 0 && gameState.board) {
      npc.dangerZones = DangerDetector.calculateDangerZones(
        gameState.bombs,
        gameState.board,
        npc.maxRows,
        npc.maxCols
      )
    } else {
      npc.dangerZones.clear()
    }

    // Store game state for decision-making
    npc.gameState = gameState
    
    // Update behavior strategy based on current game state
    npc.strategy = BehaviorStrategies.getStrategy(npc, gameState)
    
    // Track position history for loop detection
    NPCState.updatePositionHistory(npc)
  }

  /**
   * Updates navigation grid for pathfinding
   * Converts game board to pathfinding-friendly format
   * @param {Object} npc - NPC instance
   * @param {Object} gameState - Current game state
   */
  static updateNavigationGrid(npc, gameState) {
    if (!gameState.board) {
      return
    }

    // Convert board to navigation grid
    // 0 = walkable, 1 = blocked (destructible block or wall), 2 = indestructible wall
    npc.navigationGrid = gameState.board.map(row => 
      row.map(cell => {
        // 0 = walkable, 1 = destructible block, 2 = indestructible wall
        return cell === 0 ? 0 : 1 // Treat all non-walkable as blocked for pathfinding
      })
    )

    // Mark positions with active bombs as blocked (bombs block movement)
    if (gameState.bombs && gameState.bombs.length > 0) {
      gameState.bombs.forEach(bomb => {
        // Grid is structured as grid[row][col], and x=row, y=col
        if (npc.navigationGrid[bomb.x] && npc.navigationGrid[bomb.x][bomb.y] !== undefined) {
          npc.navigationGrid[bomb.x][bomb.y] = 1 // Blocked by bomb
        }
      })
    }

    // Also mark positions with active explosions as blocked
    if (gameState.explosions) {
      gameState.explosions.forEach(explosion => {
        // Grid is structured as grid[row][col], and x=row, y=col
        if (npc.navigationGrid[explosion.x] && npc.navigationGrid[explosion.x][explosion.y] !== undefined) {
          npc.navigationGrid[explosion.x][explosion.y] = 1 // Blocked by explosion
        }
      })
    }
  }

  /**
   * Updates position history for loop detection
   * @param {Object} npc - NPC instance
   */
  static updatePositionHistory(npc) {
    const posKey = `${npc.position.x},${npc.position.y}`
    npc.lastPositions.push(posKey)
    
    // Keep only recent positions
    if (npc.lastPositions.length > npc.positionHistorySize) {
      npc.lastPositions.shift()
    }
  }

  /**
   * Resets NPC state to initial values
   * @param {Object} npc - NPC instance
   */
  static reset(npc) {
    npc.position = { x: 0, y: 0 }
    npc.alive = true
    npc.score = 0
    npc.lives = 3
    npc.lastActionTime = 0
    npc.currentTarget = null
    npc.path = []
    npc.dangerZones.clear()
    npc.navigationGrid = null
    npc.state = 'idle'
    npc.strategy = null
    npc.lastPositions = []
    npc.stuckCounter = 0
    npc.lastTargetSwitch = 0
  }
}

module.exports = NPCState
