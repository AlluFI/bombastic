/**
 * Escape Behavior Handler
 * 
 * Handles NPC escape behavior when in danger zones.
 * Includes danger detection, escape pathfinding, and safe direction selection.
 */

const DangerDetector = require('../utils/DangerDetector')
const Pathfinder = require('../utils/Pathfinder')
const PositionHelpers = require('../utils/PositionHelpers')

/**
 * Checks if NPC is currently in a danger zone
 * @param {Object} npc - NPC instance
 * @returns {boolean}
 */
function isInDanger(npc) {
  const key = `${npc.position.x},${npc.position.y}`
  return npc.dangerZones.has(key)
}

/**
 * Decides escape action when in danger
 * Uses pathfinding to find nearest safe position
 * @param {Object} npc - NPC instance
 * @param {string|null} preferredDirection - Preferred direction to continue escaping (prevents oscillation)
 * @param {boolean} allowLessSafe - If true, allow moving to less-safe positions (when we MUST escape)
 * @returns {Object|null} Action object or null if no safe path
 */
function decideEscape(npc, preferredDirection = null, allowLessSafe = false) {
  if (!npc.navigationGrid || !npc.gameState) {
    // Fallback to random direction if no grid available
    return getRandomSafeDirection(npc, preferredDirection, allowLessSafe)
  }

  // IMPORTANT: If we're already at a safe position, clear the escape target and return null
  // This prevents oscillation when NPCs reach safety
  // BUT: Also check if there are bombs that will explode soon - NPCs should wait until bombs fully explode
  const currentPosKey = `${npc.position.x},${npc.position.y}`
  const currentlyInDanger = npc.dangerZones.has(currentPosKey)
  
  // Check if there are any bombs nearby that haven't exploded yet
  // NPCs should wait until all nearby bombs have fully exploded (removed from gameState.bombs) before moving
  // We check if bombs exist in gameState.bombs - if they're still there, they haven't exploded yet
  let hasNearbyActiveBombs = false
  if (npc.gameState && npc.gameState.bombs && npc.gameState.bombs.length > 0) {
    const now = Date.now()
    hasNearbyActiveBombs = npc.gameState.bombs.some(bomb => {
      // Check if bomb is nearby (within explosion range + safety margin)
      const distance = Pathfinder.manhattanDistance(npc.position, { x: bomb.x, y: bomb.y })
      const range = bomb.range || 2
      const safetyMargin = 2 // Extra tiles to wait before considering it safe
      if (distance > range + safetyMargin) {
        // Bomb is far away, not a concern
        return false
      }
      
      // If bomb is still in gameState.bombs, it hasn't exploded yet - wait!
      // Bombs are removed from gameState.bombs when they explode
      return true
    })
  }
  
  if (!currentlyInDanger && !hasNearbyActiveBombs) {
    // We're safe and no nearby bombs are active - but wait a bit after explosions before moving
    const EXPLOSION_COOLDOWN = 2500 // Wait 2.5 seconds after explosions before moving again (increased to prevent stepping into blast zones)
    const timeSinceLastExplosion = Date.now() - npc.lastExplosionTime
    if (timeSinceLastExplosion < EXPLOSION_COOLDOWN) {
      // Still in post-explosion cooldown - stay put
      return null
    }
    
    // We're safe and no nearby bombs are active - clear escape target and allow normal behavior
    npc.escapeTarget = null
    return null
  }

  // If we already have an escape target and we're still in danger, keep moving toward it
  // This prevents oscillation by committing to one escape route
  let safePosition = npc.escapeTarget
  
  // Verify the escape target is still valid (safe and reachable)
  if (safePosition) {
    // Check if we've already reached the escape target (within 1 tile)
    const distanceToTarget = Pathfinder.manhattanDistance(npc.position, safePosition)
    if (distanceToTarget <= 1) {
      // We're very close to or at the escape target - check if it's safe
      const targetKey = `${safePosition.x},${safePosition.y}`
      if (!npc.dangerZones.has(targetKey)) {
        // Target is safe and we're close - clear it so we don't oscillate
        npc.escapeTarget = null
        safePosition = null
      }
    } else {
      // Still moving toward target - verify it's still valid
      const targetKey = `${safePosition.x},${safePosition.y}`
      const targetStillSafe = !npc.dangerZones.has(targetKey)
      const targetStillReachable = PositionHelpers.isValidPosition(safePosition, npc.maxRows, npc.maxCols) && 
                                    npc.navigationGrid[safePosition.x] && 
                                    npc.navigationGrid[safePosition.x][safePosition.y] === 0
      
      if (!targetStillSafe || !targetStillReachable) {
        // Escape target is no longer valid, find a new one
        npc.escapeTarget = null
        safePosition = null
      }
    }
  }
  
  // If no valid escape target, find a new one
  if (!safePosition) {
    safePosition = DangerDetector.findNearestSafePosition(
      npc.position,
      npc.dangerZones,
      npc.navigationGrid,
      npc.maxRows,
      npc.maxCols
    )
    
    if (safePosition) {
      // Store the escape target so we commit to this route
      npc.escapeTarget = safePosition
    }
  }

  if (!safePosition) {
    // No safe position found, try random safe direction
    return getRandomSafeDirection(npc, preferredDirection, allowLessSafe)
  }

  // Use pathfinding to get direction toward safe position
  // IMPORTANT: If we have a preferred direction (from last step), prefer it to prevent oscillation
  // This ensures NPCs continue moving in the same direction toward the escape target
  let direction = null
  
  if (preferredDirection) {
    // We have a preferred direction - check if it's still valid and moves us closer to safety
    const preferredNextPos = PositionHelpers.getNextPosition(npc.position, preferredDirection)
    if (PositionHelpers.isValidPosition(preferredNextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, preferredNextPos)) {
      const preferredDist = Pathfinder.manhattanDistance(preferredNextPos, safePosition)
      const currentDist = Pathfinder.manhattanDistance(npc.position, safePosition)
      if (preferredDist < currentDist) {
        // Preferred direction is valid and moves us closer to safety - use it!
        direction = preferredDirection
      }
    }
  }
  
  // If no preferred direction or it's not valid, use pathfinding
  if (!direction) {
    direction = Pathfinder.getNextDirection(
      npc.position,
      safePosition,
      npc.navigationGrid,
      npc.maxRows,
      npc.maxCols
    )
  }

  if (direction) {
    // Always move toward the safe position if we found one using pathfinding
    // Even if the next step is still in danger, it's moving us closer to safety
    // (this prevents oscillation - we commit to moving toward the safe position)
    const nextPos = PositionHelpers.getNextPosition(npc.position, direction)
    
    // Check if position is walkable (we'll move even if still in danger if allowLessSafe is true)
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos)) {
      const nextPosInDanger = DangerDetector.isInDanger(nextPos, npc.dangerZones)
      
      // Only move if: (1) next position is safe, OR (2) allowLessSafe is true AND we have a safe target
      if (!nextPosInDanger || (allowLessSafe && safePosition)) {
        npc.state = 'escaping'
        
        // If we're moving to a safe position (not in danger), and it's our escape target, clear the target
        // This prevents oscillation when NPCs reach safety
        if (!nextPosInDanger && safePosition && Pathfinder.manhattanDistance(nextPos, safePosition) <= 1) {
          npc.escapeTarget = null
        }
        
        return {
          type: 'MOVE',
          direction: direction,
        }
      }
    }
  }

  // Fallback to random safe direction (pass preferredDirection to prevent oscillation)
  return getRandomSafeDirection(npc, preferredDirection, allowLessSafe)
}

/**
 * Gets a random safe direction (fallback when pathfinding fails)
 * Tries to find a safe direction, but if none exists, tries the "best available" direction
 * @param {Object} npc - NPC instance
 * @param {string|null} preferredDirection - Preferred direction to continue escaping (prevents oscillation)
 * @param {boolean} allowLessSafe - If true, allow moving to less-safe positions (when we MUST escape)
 * @returns {Object|null} Action object or null
 */
function getRandomSafeDirection(npc, preferredDirection = null, allowLessSafe = false) {
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  
  // If we have a preferred direction, try it first to prevent oscillation
  let shuffled
  if (preferredDirection && directions.includes(preferredDirection)) {
    shuffled = [preferredDirection, ...directions.filter(d => d !== preferredDirection)]
  } else {
    shuffled = directions.sort(() => Math.random() - 0.5)
  }

  // First, try to find a perfectly safe direction
  for (const dir of shuffled) {
    const nextPos = PositionHelpers.getNextPosition(npc.position, dir)
    
    // Check if position is valid, walkable, and safe
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos) &&
        !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
      npc.state = 'escaping'
      return {
        type: 'MOVE',
        direction: dir,
      }
    }
  }

  // No perfectly safe direction found
  // If allowLessSafe is true, we MUST escape (e.g., after placing a bomb)
  // In this case, use pathfinding to find the nearest safe position (even if it's multiple steps away)
  if (allowLessSafe && npc.navigationGrid && npc.gameState) {
    const safePosition = DangerDetector.findNearestSafePosition(
      npc.position,
      npc.dangerZones,
      npc.navigationGrid,
      npc.maxRows,
      npc.maxCols
    )
    
    if (safePosition) {
      // Use pathfinding to get direction toward safe position
      const direction = Pathfinder.getNextDirection(
        npc.position,
        safePosition,
        npc.navigationGrid,
        npc.maxRows,
        npc.maxCols
      )
      
      if (direction) {
        const nextPos = PositionHelpers.getNextPosition(npc.position, direction)
        // Even if next position is in danger, move toward the safe position
        // (this helps NPCs escape corners where all adjacent positions are in danger)
        if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
            PositionHelpers.isWalkable(npc, nextPos)) {
          npc.state = 'escaping'
          return {
            type: 'MOVE',
            direction: direction,
          }
        }
      }
    }
  }
  
  // No safe position found - return null and wait
  // NPCs will try again in the next cycle (danger zones might have changed)
  return null
}

/**
 * Checks if NPC has an escape route available
 * @param {Object} npc - NPC instance
 * @returns {boolean}
 */
function hasEscapeRoute(npc) {
  if (!npc.navigationGrid) {
    return true // Assume safe if no grid (fallback)
  }

  // Check if at least one adjacent position is safe and walkable
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  for (const dir of directions) {
    const nextPos = PositionHelpers.getNextPosition(npc.position, dir)
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos) &&
        !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
      return true
    }
  }

  return false
}

module.exports = {
  isInDanger,
  decideEscape,
  getRandomSafeDirection,
  hasEscapeRoute
}
