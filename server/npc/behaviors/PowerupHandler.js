/**
 * Powerup Behavior Handler
 * 
 * Handles NPC powerup collection behavior.
 * Uses ItemEvaluator to find and evaluate powerups.
 */

const ItemEvaluator = require('../utils/ItemEvaluator')
const Pathfinder = require('../utils/Pathfinder')
const DangerDetector = require('../utils/DangerDetector')
const PositionHelpers = require('../utils/PositionHelpers')

/**
 * Decides if NPC should collect a nearby powerup
 * Uses ItemEvaluator to find best powerup
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Action object or null
 */
function decideCollectPowerup(npc) {
  if (!npc.gameState || !npc.gameState.powerups || npc.gameState.powerups.length === 0) {
    return null
  }

  // Use ItemEvaluator to find best powerup
  const npcState = {
    position: npc.position,
    score: npc.score,
    lives: npc.lives,
  }

  const bestPowerup = ItemEvaluator.findBestPowerup(
    npc.gameState.powerups,
    npcState,
    npc.strategy.targetPriority.powerups
  )

  if (!bestPowerup) {
    return null
  }

  // Check if powerup is worth collecting (considering danger)
  if (!ItemEvaluator.isPowerupWorthCollecting(
    bestPowerup,
    npcState,
    npc.dangerZones,
    npc.strategy.targetPriority.powerups
  )) {
    return null
  }

  // Pathfind toward powerup
  const direction = Pathfinder.getNextDirection(
    npc.position,
    { x: bestPowerup.x, y: bestPowerup.y },
    npc.navigationGrid,
    npc.maxRows,
    npc.maxCols
  )

  if (direction) {
    const nextPos = PositionHelpers.getNextPosition(npc.position, direction)
    // Verify move is safe
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos) &&
        !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
      npc.currentTarget = { x: bestPowerup.x, y: bestPowerup.y, type: 'powerup' }
      npc.state = 'collecting'
      return {
        type: 'MOVE',
        direction: direction,
      }
    }
  }

  return null
}

/**
 * Checks if NPC has nearby powerups
 * @param {Object} npc - NPC instance
 * @returns {boolean}
 */
function hasNearbyPowerups(npc) {
  // For now, check if gameState has powerups
  if (!npc.gameState || !npc.gameState.powerups || npc.gameState.powerups.length === 0) {
    return false
  }

  // Check if any powerup is within reasonable distance
  const maxDistance = 5
  return npc.gameState.powerups.some(powerup => {
    const distance = Pathfinder.manhattanDistance(npc.position, { x: powerup.x, y: powerup.y })
    return distance <= maxDistance
  })
}

module.exports = {
  decideCollectPowerup,
  hasNearbyPowerups
}
