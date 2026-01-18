/**
 * Stuck Detection Utilities
 * 
 * Detects when NPCs are stuck in loops and helps them get unstuck.
 */

const Pathfinder = require('./Pathfinder')
const DangerDetector = require('./DangerDetector')
const PositionHelpers = require('../utils/PositionHelpers')
const EscapeHandler = require('../behaviors/EscapeHandler')

/**
 * Checks if NPC is stuck in a loop
 * IMPORTANT: Does not check if NPC is in danger - that's handled separately
 * NPCs in danger should escape first, not be marked as stuck
 * @param {Object} npc - NPC instance
 * @returns {boolean}
 */
function isStuck(npc) {
  // Don't mark as stuck if currently in danger - NPCs need to escape first
  // This prevents oscillation when NPCs are trying to escape
  if (EscapeHandler.isInDanger(npc)) {
    return false
  }
  
  // Don't mark as stuck if intentionally waiting (post-explosion cooldown or nearby bombs)
  // NPCs often stay in the same position when waiting for bombs to explode
  const EXPLOSION_COOLDOWN = 2500
  const timeSinceLastExplosion = Date.now() - npc.lastExplosionTime
  const inExplosionCooldown = timeSinceLastExplosion < EXPLOSION_COOLDOWN
  
  let hasNearbyActiveBombs = false
  if (npc.gameState && npc.gameState.bombs && npc.gameState.bombs.length > 0) {
    hasNearbyActiveBombs = npc.gameState.bombs.some(bomb => {
      const distance = Pathfinder.manhattanDistance(npc.position, { x: bomb.x, y: bomb.y })
      const range = bomb.range || 2
      return distance <= range + 2 // Safety margin
    })
  }
  
  if (inExplosionCooldown || hasNearbyActiveBombs) {
    // Intentionally waiting - not stuck
    return false
  }
  
  if (npc.lastPositions.length < 5) {
    return false
  }

  // Check if we've been in the same position too many times
  const currentPos = `${npc.position.x},${npc.position.y}`
  const samePositionCount = npc.lastPositions.filter(pos => pos === currentPos).length
  
  if (samePositionCount >= 5) {
    npc.stuckCounter++
    return true
  }

  // Check for circular movement pattern (but only if not in danger)
  const uniquePositions = new Set(npc.lastPositions)
  if (uniquePositions.size <= 3 && npc.lastPositions.length >= 8) {
    npc.stuckCounter++
    return true
  }

  // Reset stuck counter if not stuck
  npc.stuckCounter = 0
  return false
}

/**
 * Gets unstuck by switching target or using fallback routine
 * IMPORTANT: Only moves to safe positions - never moves into danger zones
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Action object
 */
function getUnstuck(npc) {
  // If we're at a safe position, don't move - stay put!
  // NPCs often get "stuck" when they're safely waiting (e.g., after escaping a bomb)
  if (!EscapeHandler.isInDanger(npc)) {
    // Also check if there are nearby active bombs - if so, stay put until they explode
    let hasNearbyActiveBombs = false
    if (npc.gameState && npc.gameState.bombs && npc.gameState.bombs.length > 0) {
      hasNearbyActiveBombs = npc.gameState.bombs.some(bomb => {
        const distance = Pathfinder.manhattanDistance(npc.position, { x: bomb.x, y: bomb.y })
        const range = bomb.range || 2
        return distance <= range + 2 // Safety margin
      })
    }
    
    // Also check post-explosion cooldown
    const EXPLOSION_COOLDOWN = 2500 // Wait 2.5 seconds after explosions (matching _decideEscape)
    const timeSinceLastExplosion = Date.now() - npc.lastExplosionTime
    const inExplosionCooldown = timeSinceLastExplosion < EXPLOSION_COOLDOWN
    
    if (!hasNearbyActiveBombs && !inExplosionCooldown) {
      // We're safe and not waiting - clear stuck state and resume normal behavior
      // Clear position history to reset stuck detection
      npc.lastPositions = []
      npc.committedDirection = null
      npc.committedDirectionUntil = 0
      npc.stuckCounter = 0 // Reset stuck counter
      
      // If we don't have a target, select one now
      if (!npc.currentTarget) {
        // Force target selection by clearing lastTargetSwitch
        npc.lastTargetSwitch = 0
      }
      
      // Return null to allow normal decision-making to proceed
      // The NPC will select a target and continue in the next cycle
      return null
    } else {
      // Clear position history but stay put until bombs explode or cooldown passes
      npc.lastPositions = []
      return null
    }
  }
  
  // Only try to get unstuck if we're actually in danger
  // Clear position history to break the loop, but keep the target if it's still valid
  // Only clear target if it's a block and we're truly stuck (can't reach it)
  if (npc.currentTarget && npc.currentTarget.type === 'block') {
    // If targeting a block and stuck, try switching to a different target
    npc.currentTarget = null
    npc.lastTargetSwitch = Date.now()
  }
  // If targeting a player, keep the target - we'll find a way to reach them
  
  // Clear position history
  npc.lastPositions = []
  
  // Try to move in a completely different direction (but only to safe positions)
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  const shuffled = directions.sort(() => Math.random() - 0.5)
  
  for (const dir of shuffled) {
    const nextPos = PositionHelpers.getNextPosition(npc.position, dir)
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos) &&
        !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
      npc.state = 'moving'
      return {
        type: 'MOVE',
        direction: dir,
      }
    }
  }

  // If still stuck and in danger, try any walkable direction (even if not ideal)
  // But prioritize safe positions if possible
  for (const dir of shuffled) {
    const nextPos = PositionHelpers.getNextPosition(npc.position, dir)
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos)) {
      const nextPosInDanger = DangerDetector.isInDanger(nextPos, npc.dangerZones)
      // Prefer safe positions, but if none available, take any walkable position
      if (!nextPosInDanger || shuffled.indexOf(dir) === shuffled.length - 1) {
        npc.state = 'moving'
        return {
          type: 'MOVE',
          direction: dir,
        }
      }
    }
  }

  return null
}

module.exports = {
  isStuck,
  getUnstuck
}
