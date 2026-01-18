/**
 * Targeting Behavior Handler
 * 
 * Handles NPC target selection and validation.
 * Selects targets (players, powerups, blocks) based on strategy priorities.
 */

const Pathfinder = require('../utils/Pathfinder')
const PositionHelpers = require('../utils/PositionHelpers')

/**
 * Selects a target based on strategy priorities
 * @param {Object} npc - NPC instance
 * @returns {Object|null} Target object { x, y, type } or null
 */
function selectTarget(npc) {
  if (!npc.strategy || !npc.gameState) {
    return null
  }

  const currentTime = Date.now()
  // Commit to targets for a LONG time to prevent oscillation
  // NPCs should stick to their targets even when players move
  const timeSinceSwitch = currentTime - npc.lastTargetSwitch
  const minTimeToSwitch = 30000 // 30 seconds - strong commitment to prevent oscillation
  const shouldSwitchTarget = timeSinceSwitch > minTimeToSwitch || npc.currentTarget === null

  if (!shouldSwitchTarget && npc.currentTarget) {
    // Keep current target if it's still valid - stay committed to the goal
    // IMPORTANT: For players, we check if the player still exists, not exact position
    // This prevents targets from changing every time players move
    if (isTargetValid(npc, npc.currentTarget)) {
      // For trappers with far-away player targets, prioritize intermediate block targets
      if (npc.currentTarget.type === 'player' && npc.strategy.name === 'trapper' && npc.gameState.players) {
        const player = npc.gameState.players.find(p => 
          p.id !== npc.id && 
          p.alive !== false && 
          (p.id === npc.currentTarget.playerId || 
           (Math.abs(p.x - npc.currentTarget.x) <= 2 && Math.abs(p.y - npc.currentTarget.y) <= 2))
        )
        if (player) {
          const distance = Pathfinder.manhattanDistance(npc.position, { x: player.x, y: player.y })
          const chaseDistance = npc.strategy.chaseDistance || 3
          
          // If player is far away, find intermediate block targets in the direction toward player
          if (distance > chaseDistance + 2) {
            const intermediateBlock = findIntermediateBlockTowardPlayer(npc, player)
            if (intermediateBlock) {
              // Switch to intermediate block target (but don't reset lastTargetSwitch - we're still pursuing the same player)
              npc.currentTarget = intermediateBlock
              npc.currentTarget.intermediateForPlayer = player.id // Track that this is intermediate
              return npc.currentTarget
            }
          }
          
          // Only update player position if they've moved significantly (more than 3 tiles)
          // This prevents constant pathfinding recalculation
          const distanceFromStoredPosition = Pathfinder.manhattanDistance(
            { x: npc.currentTarget.x, y: npc.currentTarget.y },
            { x: player.x, y: player.y }
          )
          if (distanceFromStoredPosition > 3) {
            npc.currentTarget.x = player.x
            npc.currentTarget.y = player.y
          }
          if (player.id) npc.currentTarget.playerId = player.id
          return npc.currentTarget
        }
      }
      
      // Update target position if it's a player (they move, but we keep targeting them)
      if (npc.currentTarget.type === 'player' && npc.gameState.players) {
        const player = npc.gameState.players.find(p => 
          p.id !== npc.id && 
          p.alive !== false && 
          // Match by player ID if available, or by approximate position
          (p.id === npc.currentTarget.playerId || 
           (Math.abs(p.x - npc.currentTarget.x) <= 1 && Math.abs(p.y - npc.currentTarget.y) <= 1))
        )
        if (player) {
          // Only update target position if player has moved significantly (more than 3 tiles)
          // This prevents constant pathfinding recalculation
          const distanceFromStoredPosition = Pathfinder.manhattanDistance(
            { x: npc.currentTarget.x, y: npc.currentTarget.y },
            { x: player.x, y: player.y }
          )
          if (distanceFromStoredPosition > 3) {
            npc.currentTarget.x = player.x
            npc.currentTarget.y = player.y
          }
          if (player.id) npc.currentTarget.playerId = player.id
          return npc.currentTarget
        }
      }
      return npc.currentTarget
    }
  }

  const candidates = []

  // PRIORITY 1: Find player targets - ALWAYS prioritize players if they exist
  // NPCs should always have a target if players are visible (anywhere on the board)
  // IMPORTANT: Prioritize human players over NPCs
  if (npc.strategy.targetPriority.players > 0.3 && npc.gameState.players) {
    // First, collect human players (priority targets)
    const humanPlayers = []
    const npcPlayers = []
    
    npc.gameState.players.forEach(player => {
      if (player.id !== npc.id && player.alive !== false) {
        if (player.isNPC === false || player.isNPC === undefined) {
          // Human player - highest priority
          humanPlayers.push(player)
        } else {
          // NPC player - lower priority
          npcPlayers.push(player)
        }
      }
    })
    
    // Add human players first (with higher priority boost)
    humanPlayers.forEach(player => {
      const distance = Pathfinder.manhattanDistance(npc.position, { x: player.x, y: player.y })
      const hasRoute = hasRouteToTarget(npc, { x: player.x, y: player.y, type: 'player' })
      
      candidates.push({
        x: player.x,
        y: player.y,
        type: 'player',
        priority: npc.strategy.targetPriority.players * 2.0, // 2x boost for human players
        distance: distance,
        playerId: player.id,
        hasRoute: hasRoute,
        isHuman: true, // Mark as human player
      })
    })
    
    // Add NPC players only if no human players exist (or if very close)
    if (humanPlayers.length === 0) {
      npcPlayers.forEach(player => {
        const distance = Pathfinder.manhattanDistance(npc.position, { x: player.x, y: player.y })
        const hasRoute = hasRouteToTarget(npc, { x: player.x, y: player.y, type: 'player' })
        
        candidates.push({
          x: player.x,
          y: player.y,
          type: 'player',
          priority: npc.strategy.targetPriority.players * 0.5, // Lower priority for NPCs
          distance: distance,
          playerId: player.id,
          hasRoute: hasRoute,
          isHuman: false, // Mark as NPC
        })
      })
    }
  }

  // PRIORITY 2: Find powerup targets (secondary to players)
  // Only consider powerups if no players are available, or if very close
  if (npc.strategy.targetPriority.powerups > 0.3 && npc.gameState.powerups) {
    const hasPlayerTargets = candidates.some(c => c.type === 'player')
    
    npc.gameState.powerups.forEach(powerup => {
      const distance = Pathfinder.manhattanDistance(npc.position, { x: powerup.x, y: powerup.y })
      // Check if route exists to this powerup
      const hasRoute = hasRouteToTarget(npc, { x: powerup.x, y: powerup.y, type: 'powerup' })
      
      // Only include powerups if no players available, or if very close (within 3 tiles)
      if (!hasPlayerTargets || distance <= 3) {
        candidates.push({
          x: powerup.x,
          y: powerup.y,
          type: 'powerup',
          priority: npc.strategy.targetPriority.powerups,
          distance: distance,
          hasRoute: hasRoute,
        })
      }
    })
  }

  // Find block targets - blocks are obstacles that need to be cleared to reach players
  // Always look for nearby blocks, even if players exist (blocks block the path!)
  if (npc.strategy.targetPriority.blocks > 0.3 && npc.gameState.board) {
    // Find nearby blocks that might be blocking the path to players
    for (let x = Math.max(0, npc.position.x - 3); x <= Math.min(npc.maxRows - 1, npc.position.x + 3); x++) {
      for (let y = Math.max(0, npc.position.y - 3); y <= Math.min(npc.maxCols - 1, npc.position.y + 3); y++) {
        // Grid is structured as grid[row][col], and x=row, y=col
        if (npc.gameState.board[x] && npc.gameState.board[x][y] === 1) { // Destructible block
          const distance = Pathfinder.manhattanDistance(npc.position, { x, y })
          if (distance <= 3) { // Only nearby blocks (within 3 tiles)
            candidates.push({
              x: x,
              y: y,
              type: 'block',
              priority: npc.strategy.targetPriority.blocks * 0.5, // Lower priority than players/powerups
              distance: distance,
            })
          }
        }
      }
    }
  }

  // Select best target based on priority and distance
  if (candidates.length === 0) {
    return null
  }

  // Score candidates with strategic priorities:
  // 1. Players are highest priority (attack enemies) - ALWAYS prioritize over everything
  // 2. Powerups are secondary priority (get upgrades)
  // 3. Blocks are lowest priority (only clear if blocking path or no other targets)
  // Also consider route availability - prefer targets we can actually reach
  candidates.forEach(candidate => {
    let score = candidate.priority * (10 / (candidate.distance + 1))
    
    // STRATEGIC PRIORITY BOOSTS:
    // Players are ALWAYS highest priority - NPCs should hunt players
    if (candidate.type === 'player') {
      // Human players get even higher priority than NPCs
      if (candidate.isHuman === true) {
        score *= 5.0 // Very strongly prioritize human players
      } else {
        score *= 2.0 // Lower priority for NPC players (only if no humans available)
      }
    }
    // Powerups are secondary priority
    else if (candidate.type === 'powerup') {
      score *= 1.5 // Moderate boost for powerups
    }
    // Blocks only if they're blocking path to players or no players available
    // Don't boost blocks - they're just obstacles to clear
    
    // Route availability bonus: prefer targets we can actually reach
    if (candidate.hasRoute) {
      score *= 1.2 // 20% bonus for reachable targets
    } else {
      score *= 0.5 // Penalty for unreachable targets (but don't exclude them completely)
    }
    
    candidate.score = score
  })

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score)

  // Always select the best target (no randomness) - NPCs should be strategic, not random
  const selected = candidates[0]

  npc.currentTarget = selected
  npc.lastTargetSwitch = currentTime
  npc.hasClearedTargetAfterEscape = false // Reset flag when selecting a new target

  return selected
}

/**
 * Checks if a target is still valid
 * @param {Object} npc - NPC instance
 * @param {Object} target - Target object
 * @returns {boolean}
 */
function isTargetValid(npc, target) {
  if (!target || !npc.gameState) {
    return false
  }

  switch (target.type) {
    case 'player':
      // For players, check if the player still exists and is alive
      // Don't check exact position - players move, but we keep targeting them
      if (target.playerId) {
        // If we have a player ID, match by ID
        const player = npc.gameState.players.find(p => p.id === target.playerId)
        return player && player.alive !== false
      } else {
        // Fallback: check if any player is near the target position (within 2 tiles)
        // This handles cases where player ID wasn't stored
        return npc.gameState.players.some(p => 
          p.id !== npc.id && 
          p.alive !== false &&
          Math.abs(p.x - target.x) <= 2 && 
          Math.abs(p.y - target.y) <= 2
        )
      }
    case 'powerup':
      return npc.gameState.powerups && 
             npc.gameState.powerups.some(p => p.x === target.x && p.y === target.y)
    case 'block':
      // If this is an intermediate block for a player, check if player still exists
      if (target.intermediateForPlayer) {
        const player = npc.gameState.players.find(p => p.id === target.intermediateForPlayer)
        if (!player || player.alive === false) {
          return false // Player is gone, intermediate block is no longer valid
        }
        
        // Check if block still exists
        const blockExists = npc.gameState.board && 
                           npc.gameState.board[target.x] && 
                           npc.gameState.board[target.x][target.y] === 1
        
        if (!blockExists) {
          // Block was destroyed - find next intermediate block toward player
          // This prevents oscillation by immediately finding the next waypoint
          const nextIntermediate = findIntermediateBlockTowardPlayer(npc, player)
          if (nextIntermediate) {
            npc.currentTarget = nextIntermediate
            npc.currentTarget.intermediateForPlayer = player.id
            return true // New intermediate target is valid
          } else {
            // No more intermediate blocks - switch back to player target
            npc.currentTarget = {
              x: player.x,
              y: player.y,
              type: 'player',
              playerId: player.id
            }
            return true // Player target is valid
          }
        }
        
        // Block still exists and we're moving toward it
        return true
      }
      return npc.gameState.board && 
             npc.gameState.board[target.x] && 
             // Grid is structured as grid[row][col], and x=row, y=col
             npc.gameState.board[target.x][target.y] === 1
    default:
      return false
  }
}

/**
 * Checks if there's a route to a target (pathfinding check)
 * @param {Object} npc - NPC instance
 * @param {Object} target - Target object { x, y, type }
 * @returns {boolean}
 */
function hasRouteToTarget(npc, target) {
  if (!npc.navigationGrid || !target) {
    return true // Assume reachable if no grid (fallback)
  }

  // Try to find a path to the target
  const path = Pathfinder.findPath(
    npc.position,
    { x: target.x, y: target.y },
    npc.navigationGrid,
    npc.maxRows,
    npc.maxCols
  )

  return path !== null && path.length > 0
}

/**
 * Finds a blocking block in the path toward a target
 * @param {Object} npc - NPC instance
 * @param {Object} target - Target object { x, y }
 * @returns {Object|null} Block position { x, y, type } or null
 */
function findBlockingBlock(npc, target) {
  if (!npc.gameState.board || !target) return null
  
  // Find blocks that are in the direct path to the target
  const dx = target.x - npc.position.x
  const dy = target.y - npc.position.y
  
  // Check blocks in the direction toward target (within 2 tiles)
  const checkDistance = Math.min(2, Math.max(Math.abs(dx), Math.abs(dy)))
  const stepX = dx !== 0 ? dx / Math.abs(dx) : 0
  const stepY = dy !== 0 ? dy / Math.abs(dy) : 0
  
  for (let i = 1; i <= checkDistance; i++) {
    const checkX = npc.position.x + stepX * i
    const checkY = npc.position.y + stepY * i
    
    if (PositionHelpers.isValidPosition({ x: checkX, y: checkY }, npc.maxRows, npc.maxCols)) {
      if (npc.gameState.board[checkX] && npc.gameState.board[checkX][checkY] === 1) {
        // Found a blocking block
        return { x: checkX, y: checkY, type: 'block' }
      }
    }
  }
  
  // If no direct path block, find nearest block
  for (let x = Math.max(0, npc.position.x - 2); x <= Math.min(npc.maxRows - 1, npc.position.x + 2); x++) {
    for (let y = Math.max(0, npc.position.y - 2); y <= Math.min(npc.maxCols - 1, npc.position.y + 2); y++) {
      if (npc.gameState.board[x] && npc.gameState.board[x][y] === 1) {
        return { x: x, y: y, type: 'block' }
      }
    }
  }
  
  return null
}

/**
 * Finds an intermediate block target in the direction toward a far-away player
 * Used by trappers to create clear waypoints when player is far away
 * @param {Object} npc - NPC instance
 * @param {Object} player - Player object { x, y, id }
 * @returns {Object|null} Intermediate block position { x, y, type } or null
 */
function findIntermediateBlockTowardPlayer(npc, player) {
  if (!npc.gameState.board || !player) return null
  
  const dx = player.x - npc.position.x
  const dy = player.y - npc.position.y
  
  // Find blocks in the general direction toward the player (within 4-6 tiles)
  // This gives clear intermediate targets when player is far away
  const searchRadius = 5 // Search up to 5 tiles in the direction toward player
  const stepX = dx !== 0 ? dx / Math.abs(dx) : 0
  const stepY = dy !== 0 ? dy / Math.abs(dy) : 0
  
  // Prioritize blocks that are closer to NPC but in the direction toward player
  const candidates = []
  
  for (let i = 2; i <= searchRadius; i++) {
    const checkX = npc.position.x + stepX * i
    const checkY = npc.position.y + stepY * i
    
    // Also check perpendicular directions (to find blocks that are "in the way")
    const perpendicularOffsets = [
      { x: 0, y: 0 },      // Direct path
      { x: stepY, y: -stepX },  // Perpendicular 1
      { x: -stepY, y: stepX },  // Perpendicular 2
    ]
    
    for (const offset of perpendicularOffsets) {
      const finalX = checkX + offset.x
      const finalY = checkY + offset.y
      
      if (PositionHelpers.isValidPosition({ x: finalX, y: finalY }, npc.maxRows, npc.maxCols)) {
        if (npc.gameState.board[finalX] && npc.gameState.board[finalX][finalY] === 1) {
          const distance = Pathfinder.manhattanDistance(npc.position, { x: finalX, y: finalY })
          const distanceToPlayer = Pathfinder.manhattanDistance({ x: finalX, y: finalY }, { x: player.x, y: player.y })
          
          // Prefer blocks that are:
          // 1. Not too close (at least 2 tiles away)
          // 2. Not too far (within 5 tiles)
          // 3. Closer to the player (clearing path toward player)
          if (distance >= 2 && distance <= 5) {
            candidates.push({
              x: finalX,
              y: finalY,
              type: 'block',
              distance: distance,
              distanceToPlayer: distanceToPlayer,
              score: distanceToPlayer - distance * 0.5 // Prefer blocks that are closer to player
            })
          }
        }
      }
    }
  }
  
  if (candidates.length === 0) {
    // Fallback: find any nearby block in the general direction
    for (let x = Math.max(0, npc.position.x - 3); x <= Math.min(npc.maxRows - 1, npc.position.x + 3); x++) {
      for (let y = Math.max(0, npc.position.y - 3); y <= Math.min(npc.maxCols - 1, npc.position.y + 3); y++) {
        if (npc.gameState.board[x] && npc.gameState.board[x][y] === 1) {
          const blockDx = x - npc.position.x
          const blockDy = y - npc.position.y
          // Check if block is in the general direction toward player (dot product check)
          const dotProduct = blockDx * dx + blockDy * dy
          if (dotProduct > 0) { // Block is in the forward direction
            const distance = Pathfinder.manhattanDistance(npc.position, { x, y })
            if (distance >= 2 && distance <= 5) {
              candidates.push({
                x: x,
                y: y,
                type: 'block',
                distance: distance,
                distanceToPlayer: Pathfinder.manhattanDistance({ x, y }, { x: player.x, y: player.y }),
                score: 0
              })
            }
          }
        }
      }
    }
  }
  
  if (candidates.length > 0) {
    // Sort by score (prefer blocks closer to player and in good position)
    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return a.distance - b.distance // If same score, prefer closer blocks
    })
    
    return candidates[0]
  }
  
  return null
}

module.exports = {
  selectTarget,
  isTargetValid,
  hasRouteToTarget,
  findBlockingBlock,
  findIntermediateBlockTowardPlayer
}
