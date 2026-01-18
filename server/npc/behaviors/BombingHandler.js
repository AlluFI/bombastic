/**
 * Bombing Behavior Handler
 * 
 * Handles NPC bomb placement decisions.
 * Includes safety checks and target evaluation.
 */

const DangerDetector = require('../utils/DangerDetector')
const Pathfinder = require('../utils/Pathfinder')
const PositionHelpers = require('../utils/PositionHelpers')
const EscapeHandler = require('./EscapeHandler')

/**
 * Decides if NPC should place a bomb
 * Includes safety checks to prevent suicide and basic target evaluation
 * @param {Object} npc - NPC instance
 * @param {boolean} hasBlockTarget - Whether NPC is adjacent to a block (passed from _think to avoid recalculation)
 * @param {boolean} hasPlayerTarget - Whether NPC has a player target in range (passed from _think to avoid recalculation)
 * @returns {Object|null} Action object or null
 */
function decidePlaceBomb(npc, hasBlockTarget = false, hasPlayerTarget = false) {
  if (!npc.gameState || !npc.gameState.board) {
    return null
  }

  // If we weren't passed the target info, evaluate it now
  if (hasBlockTarget === false && hasPlayerTarget === false) {
    const targets = evaluateBombTargets(npc)
    hasBlockTarget = targets.hasBlockTarget
    hasPlayerTarget = targets.hasPlayerTarget
  }

  if (!hasPlayerTarget && !hasBlockTarget) {
    // No reason to bomb here
    return null
  }

  // CRITICAL: If we're adjacent to ANY block, prioritize bombing it
  // This ensures NPCs place bombs to clear paths, even if they're currently targeting a player
  // Check this FIRST before other safety checks (except immediate explosion danger)
  if (hasBlockTarget) {
    // Safety check: Don't place a new bomb if another explosion is about to happen here
    const timeUntilExplosion = DangerDetector.getTimeUntilExplosion(npc.position, npc.gameState.bombs || [])
    if (timeUntilExplosion !== null && timeUntilExplosion < 1000) {
      return null
    }
    
    // When adjacent to blocks, be very lenient with cooldown
    // Allow bombing if cooldown is almost done (< 1000ms remaining) or if it's been a while
    const BOMB_COOLDOWN = 2500 // 2.5 seconds
    const timeSinceLastBomb = Date.now() - npc.lastBombTime
    const cooldownRemaining = BOMB_COOLDOWN - timeSinceLastBomb
    
    // If cooldown is almost done (< 1000ms remaining), allow bombing blocks
    // This prevents NPCs from getting stuck waiting when they need to clear paths
    if (timeSinceLastBomb < BOMB_COOLDOWN && cooldownRemaining > 1000) {
      // Still in cooldown and more than 1000ms remaining - wait a bit longer
      return null
    }
    
    // Place bomb when adjacent to blocks - bypass other safety checks
    // This ensures NPCs place bombs when adjacent to blocks, regardless of current target or danger
    npc.state = 'attacking'
    npc.lastBombTime = Date.now() // Track when bomb was placed
    return {
      type: 'BOMB',
    }
  }

  // For non-block targets, apply normal safety checks
  // Safety check: Never place bomb if currently in danger
  if (EscapeHandler.isInDanger(npc)) {
    return null
  }

  // Safety check: Don't place a new bomb if another explosion is about to happen here
  const timeUntilExplosion = DangerDetector.getTimeUntilExplosion(npc.position, npc.gameState.bombs || [])
  if (timeUntilExplosion !== null && timeUntilExplosion < 1000) {
    return null
  }

  // Bomb cooldown: Don't place another bomb too soon after placing one
  // This gives NPCs time to escape after placing a bomb
  const BOMB_COOLDOWN = 2500 // 2.5 seconds (bombs explode after 3 seconds)
  const timeSinceLastBomb = Date.now() - npc.lastBombTime
  if (timeSinceLastBomb < BOMB_COOLDOWN) {
    // Still in cooldown - prioritize escaping instead of placing another bomb
    return null
  }

  // For other situations, apply normal safety checks
  // Simulate "mistakes" for easier difficulties: sometimes skip good bomb opportunities
  // But be more lenient when bombing blocks (NPCs need to clear paths to move)
  let successThreshold = npc.profile.bombPlacementSuccess || (1 - (npc.profile.mistakeRate || 0.15))
  if (!hasPlayerTarget && hasBlockTarget) {
    // Increase success rate when bombing blocks (reduce mistakes)
    successThreshold = Math.min(1.0, successThreshold + 0.2)
  }
  const successRoll = Math.random()
  if (successRoll > successThreshold) {
    return null
  }

  // Safety check: Verify there's an escape route after placing bomb
  // This prevents NPC from trapping itself
  // But be more lenient for medium difficulty when bombing blocks
  if (!EscapeHandler.hasEscapeRoute(npc)) {
    // When bombing blocks (not players), be more willing to take risks
    if (!hasPlayerTarget && hasBlockTarget) {
      if (npc.difficulty === 'hard' && Math.random() < 0.5) {
        // Hard NPCs take risks to clear blocks
      } else if (npc.difficulty === 'medium' && Math.random() < 0.3) {
        // Medium NPCs sometimes take risks
      } else {
        return null
      }
    } else {
      // For player targets, be more cautious
      if (npc.difficulty !== 'hard' || Math.random() > 0.3) {
        return null
      }
    }
  }

  // At this point we have a valid reason to bomb and an escape route
  npc.state = 'attacking'
  npc.lastBombTime = Date.now() // Track when bomb was placed
  return {
    type: 'BOMB',
  }
}

/**
 * Evaluates if there are good bomb targets nearby (players or destructible blocks)
 * Uses difficulty profile to determine ranges and priorities.
 * @param {Object} npc - NPC instance
 * @returns {{ hasPlayerTarget: boolean, hasBlockTarget: boolean }}
 */
function evaluateBombTargets(npc) {
  let hasPlayerTarget = false
  let hasBlockTarget = false

  if (!npc.gameState || !npc.gameState.board) {
    return { hasPlayerTarget: false, hasBlockTarget: false }
  }

  const board = npc.gameState.board
  const attackRange = npc.profile.attackRange || 2

  // Check for player targets within attack range (Manhattan distance)
  // OR if we're currently targeting a player (even if beyond immediate attack range)
  if (npc.currentTarget?.type === 'player') {
    // We have a player target - check if they're still valid and within reasonable range
    const targetPlayer = npc.gameState.players?.find(p => p.id === npc.currentTarget.playerId)
    if (targetPlayer && targetPlayer.alive) {
      const dist = Pathfinder.manhattanDistance(npc.position, { x: targetPlayer.x, y: targetPlayer.y })
      // If player is within attack range, we can bomb them
      // If player is further away, we're still targeting them (moving towards them)
      if (dist <= attackRange) {
        hasPlayerTarget = true
      } else {
        // Player is beyond attack range but we're targeting them - still consider it a player target
        // This helps NPCs know they're pursuing a player even if not in immediate bombing range
        hasPlayerTarget = true
      }
    }
  }
  
  // Also check for any other players within attack range (for opportunistic bombing)
  if (!hasPlayerTarget && npc.gameState.players && npc.gameState.players.length > 1) {
    for (const p of npc.gameState.players) {
      if (p.id === npc.id || p.alive === false) continue
      const dist = Pathfinder.manhattanDistance(npc.position, { x: p.x, y: p.y })
      if (dist > 0 && dist <= attackRange) {
        hasPlayerTarget = true
        break
      }
    }
  }

  // Check for adjacent destructible blocks (distance 1) - NPCs must be next to blocks to bomb them
  // This ensures NPCs move close to blocks before placing bombs
  const directions = [
    { x: -1, y: 0 },  // UP (one tile above)
    { x: 1, y: 0 },   // DOWN (one tile below)
    { x: 0, y: -1 },  // LEFT (one tile left)
    { x: 0, y: 1 },   // RIGHT (one tile right)
  ]
  
  for (const dir of directions) {
    const x = npc.position.x + dir.x
    const y = npc.position.y + dir.y
    if (!PositionHelpers.isValidPosition({ x, y }, npc.maxRows, npc.maxCols)) {
      continue
    }
    // Grid is structured as grid[row][col], and x=row, y=col
    if (!board[x]) {
      continue
    }
    const cellValue = board[x][y]
    if (cellValue === 1) { // 1 = destructible block (adjacent to NPC)
      hasBlockTarget = true
      break
    }
  }

  return { hasPlayerTarget, hasBlockTarget }
}

module.exports = {
  decidePlaceBomb,
  evaluateBombTargets
}
