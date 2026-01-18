/**
 * Movement Behavior Handler
 * 
 * Handles NPC movement decisions and pathfinding.
 * Includes target-based movement, exploration, and wandering.
 */

const Pathfinder = require('../utils/Pathfinder')
const DangerDetector = require('../utils/DangerDetector')
const PositionHelpers = require('../utils/PositionHelpers')
const TargetingHandler = require('./TargetingHandler')

/**
 * Decides movement action toward target or exploration
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Action object or null
 */
function decideMovement(npc) {
  // CRITICAL: Check committed direction FIRST - before any other logic
  // This prevents oscillation by making NPCs stick to a direction until blocked or target reached
  const now = Date.now()
  if (npc.committedDirection && now < npc.committedDirectionUntil) {
    const committedNextPos = PositionHelpers.getNextPosition(npc.position, npc.committedDirection)
    // Only check if valid and walkable - allow moving even if in danger if we're committed
    // (NPCs should continue in their committed direction unless truly blocked)
    if (PositionHelpers.isValidPosition(committedNextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, committedNextPos)) {
      // Continue in committed direction (prevents oscillation)
      // Check danger only as a secondary concern - commitment is primary
      const nextPosInDanger = DangerDetector.isInDanger(committedNextPos, npc.dangerZones)
      if (!nextPosInDanger) {
        return {
          type: 'MOVE',
          direction: npc.committedDirection,
        }
      } else {
        // Committed direction leads to danger - wait until safe or clear commitment
        return null // Wait instead of moving into danger
      }
    } else {
      // Committed direction is blocked - clear it and recalculate
      npc.committedDirection = null
      npc.committedDirectionUntil = 0
    }
  }
  
  // Select or update target based on strategy
  const target = TargetingHandler.selectTarget(npc)
  
  // If we're already adjacent to a block target, don't move - we should bomb it instead
  // (This prevents oscillation when adjacent to blocks)
  if (target?.type === 'block') {
    const distance = Pathfinder.manhattanDistance(npc.position, target)
    if (distance <= 1) {
      // Already adjacent - don't move, wait for bomb placement decision
      return null
    }
  }
  
  if (target && npc.navigationGrid) {
    // If target is a block, find nearest walkable position adjacent to it
    // (since blocks are not walkable, we can't pathfind directly to them)
    let pathfindingTarget = target
    if (target.type === 'block') {
      // Find nearest walkable position adjacent to the block
      const adjacentPositions = [
        { x: target.x - 1, y: target.y }, // UP
        { x: target.x + 1, y: target.y }, // DOWN
        { x: target.x, y: target.y - 1 }, // LEFT
        { x: target.x, y: target.y + 1 }, // RIGHT
      ]
      
      // Find the closest walkable adjacent position
      let closestAdjacent = null
      let closestDistance = Infinity
      for (const adj of adjacentPositions) {
        if (PositionHelpers.isValidPosition(adj, npc.maxRows, npc.maxCols) && 
            PositionHelpers.isWalkable(npc, adj)) {
          const dist = Pathfinder.manhattanDistance(npc.position, adj)
          if (dist < closestDistance) {
            closestDistance = dist
            closestAdjacent = adj
          }
        }
      }
      
      if (closestAdjacent) {
        pathfindingTarget = closestAdjacent
      } else {
        // No walkable adjacent position found, skip this target
        return decideSafeExploration(npc)
      }
    }
    
    // Use pathfinding when navigation grid is available
    const direction = Pathfinder.getNextDirection(
      npc.position,
      pathfindingTarget,
      npc.navigationGrid,
      npc.maxRows,
      npc.maxCols
    )

    if (direction) {
      const nextPos = PositionHelpers.getNextPosition(npc.position, direction)
      // Verify the move is safe
      if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
          PositionHelpers.isWalkable(npc, nextPos) &&
          !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
        npc.state = 'moving'
        
        // Commit to this direction - longer for trappers with far-away targets
        let commitmentDuration = 4000 // Default 4 seconds
        if (npc.strategy.name === 'trapper' && target && target.type === 'player') {
          const distance = Pathfinder.manhattanDistance(npc.position, target)
          if (distance > 5) {
            // Far-away target - commit longer to prevent oscillation
            commitmentDuration = 8000 // 8 seconds for far targets
          }
        }
        
        npc.committedDirection = direction
        npc.committedDirectionUntil = Date.now() + commitmentDuration
        
        return {
          type: 'MOVE',
          direction: direction,
        }
      }
    } else {
      // Pathfinding failed - target might be unreachable due to blocks
      // If target is a player and we can't reach them, find a blocking block
      if (target.type === 'player' && !npc._pathfindingRecursionDepth) {
        // For trappers with far-away players, use intermediate block finding
        if (npc.strategy.name === 'trapper') {
          const distance = Pathfinder.manhattanDistance(npc.position, target)
          const chaseDistance = npc.strategy.chaseDistance || 3
          
          if (distance > chaseDistance + 2) {
            // Player is far away - find intermediate block
            const player = npc.gameState.players.find(p => 
              p.id === target.playerId || 
              (Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1)
            )
            if (player) {
              const intermediateBlock = TargetingHandler.findIntermediateBlockTowardPlayer(npc, player)
              if (intermediateBlock) {
                npc.currentTarget = intermediateBlock
                npc.currentTarget.intermediateForPlayer = player.id
                // Don't reset lastTargetSwitch - we're still pursuing the same player
                // Try moving toward the intermediate block
                npc._pathfindingRecursionDepth = 1
                const result = decideMovement(npc)
                npc._pathfindingRecursionDepth = 0
                if (result) return result
              }
            }
          }
        }
        
        // Fallback to normal blocking block finding
        const blockingBlock = TargetingHandler.findBlockingBlock(npc, target)
        if (blockingBlock) {
          // Switch to targeting the blocking block
          npc.currentTarget = blockingBlock
          npc.lastTargetSwitch = Date.now()
          // Try moving toward the block (limit recursion to prevent infinite loops)
          npc._pathfindingRecursionDepth = 1
          const result = decideMovement(npc)
          npc._pathfindingRecursionDepth = 0
          if (result) return result
        }
      }
    }
  } else if (target && !npc.navigationGrid) {
    // No navigation grid - use simple direction toward target
    // If target is a block, find nearest walkable adjacent position
    let moveTarget = target
    if (target.type === 'block') {
      const adjacentPositions = [
        { x: target.x - 1, y: target.y }, // UP
        { x: target.x + 1, y: target.y }, // DOWN
        { x: target.x, y: target.y - 1 }, // LEFT
        { x: target.x, y: target.y + 1 }, // RIGHT
      ]
      
      let closestAdjacent = null
      let closestDistance = Infinity
      for (const adj of adjacentPositions) {
        if (PositionHelpers.isValidPosition(adj, npc.maxRows, npc.maxCols) && 
            PositionHelpers.isWalkable(npc, adj)) {
          const dist = Pathfinder.manhattanDistance(npc.position, adj)
          if (dist < closestDistance) {
            closestDistance = dist
            closestAdjacent = adj
          }
        }
      }
      
      if (closestAdjacent) {
        moveTarget = closestAdjacent
      } else {
        return decideSafeExploration(npc)
      }
    }
    
    // Coordinate system: x = row (vertical), y = col (horizontal)
    const dx = moveTarget.x - npc.position.x
    const dy = moveTarget.y - npc.position.y
    
    // Choose direction based on largest distance component
    let direction = null
    if (Math.abs(dx) > Math.abs(dy)) {
      // Row difference is larger - move vertically
      direction = dx > 0 ? 'DOWN' : 'UP' // Increase row = DOWN, decrease row = UP
    } else if (dy !== 0) {
      // Col difference is larger - move horizontally
      direction = dy > 0 ? 'RIGHT' : 'LEFT' // Increase col = RIGHT, decrease col = LEFT
    }
    
    if (direction) {
      const nextPos = PositionHelpers.getNextPosition(npc.position, direction)
      if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
          PositionHelpers.isWalkable(npc, nextPos) &&
          !DangerDetector.isInDanger(nextPos, npc.dangerZones)) {
        npc.state = 'moving'
        return {
          type: 'MOVE',
          direction: direction,
        }
      }
    }
  }

  // No target or pathfinding failed - explore safely
  // But if we have a target and just can't reach it, try to find a path-clearing block
  if (target && target.type === 'player' && !npc._pathfindingRecursionDepth) {
    // Can't reach player - find a blocking block to clear
    const blockingBlock = TargetingHandler.findBlockingBlock(npc, target)
    if (blockingBlock) {
      npc.currentTarget = blockingBlock
      npc.lastTargetSwitch = Date.now()
      // Try moving toward the block (limit recursion to prevent infinite loops)
      npc._pathfindingRecursionDepth = 1
      const result = decideMovement(npc)
      npc._pathfindingRecursionDepth = 0
      if (result) return result
    }
  }
  
  return decideSafeExploration(npc)
}

/**
 * Decides safe exploration movement (when no specific target)
 * Avoids danger zones and blocked paths
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Action object or null
 */
function decideSafeExploration(npc) {
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  const shuffled = directions.sort(() => Math.random() - 0.5)

  // Try to find a safe direction
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

  // No safe direction found - stay put
  // (Better than moving into danger)
  return null
}

/**
 * Decides wander movement (random exploration)
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Action object
 */
function decideWander(npc) {
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

  return null
}

module.exports = {
  decideMovement,
  decideSafeExploration,
  decideWander
}
