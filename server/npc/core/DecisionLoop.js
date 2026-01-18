/**
 * Decision Loop Module
 * 
 * Core NPC decision-making loop (Sense → Think → Act).
 * Coordinates behavior handlers to make decisions.
 */

const DangerDetector = require('../utils/DangerDetector')
const Pathfinder = require('../utils/Pathfinder')
const BehaviorStrategies = require('../BehaviorStrategies')
const PositionHelpers = require('../utils/PositionHelpers')
const EscapeHandler = require('../behaviors/EscapeHandler')
const BombingHandler = require('../behaviors/BombingHandler')
const PowerupHandler = require('../behaviors/PowerupHandler')
const MovementHandler = require('../behaviors/MovementHandler')
const TargetingHandler = require('../behaviors/TargetingHandler')
const PlanningHandler = require('../behaviors/PlanningHandler')
const StuckDetector = require('../utils/StuckDetector')

/**
 * Main decision-making method (Sense → Think → Act)
 * Returns the next action the NPC should take
 * @param {Object} npc - NPC instance
 * @param {number} currentTime - Current timestamp (ms)
 * @returns {Object|null} Action object or null if no action needed
 */
function getNextCommand(npc, currentTime) {
  // Check if enough time has passed since last decision
  if (currentTime - npc.lastActionTime < npc.decisionInterval) {
    return null
  }

  // Don't act if dead
  if (!npc.alive) {
    return null
  }

  // Don't act if no game state available
  if (!npc.gameState) {
    return null
  }

  // CRITICAL: Always check for danger FIRST - escape takes priority over plans/commitments
  // NPCs should never move into danger zones unless they're already in danger and escaping
  const currentlyInDanger = EscapeHandler.isInDanger(npc)
  
  // HUMAN-LIKE BEHAVIOR: Execute existing plan if valid
  // Humans make a plan and execute it, not constantly re-evaluate
  // BUT: Only if not in immediate danger from other NPCs' bombs
  if (npc.currentPlan && npc.currentPlan.stepsRemaining > 0 && !currentlyInDanger) {
    const planAge = currentTime - npc.planCreatedAt
    const maxPlanAge = 5000 // Plans expire after 5 seconds (humans adapt)
    
    // Check if plan is still valid
    if (planAge < maxPlanAge && PlanningHandler.isPlanValid(npc, npc.currentPlan)) {
      // Execute next step of the plan
      const action = PlanningHandler.executePlanStep(npc, npc.currentPlan)
      if (action) {
        // Double-check that the action doesn't move into danger
        if (action.type === 'MOVE') {
          const nextPos = PositionHelpers.getNextPosition(npc.position, action.direction)
          const nextPosInDanger = DangerDetector.isInDanger(nextPos, npc.dangerZones)
          if (nextPosInDanger && !currentlyInDanger) {
            // Plan would move into danger - cancel plan and escape instead
            npc.currentPlan = null
            // Fall through to normal decision-making (which will handle escape)
          } else {
            npc.currentPlan.stepsRemaining--
            npc.lastActionTime = currentTime
            
            // Track momentum (humans continue in same direction)
            if (action.direction === npc.lastMovementDirection) {
              npc.movementMomentum++
            } else {
              npc.movementMomentum = 1
              npc.lastMovementDirection = action.direction
            }
            
            return action
          }
        } else {
          // Non-movement action - execute it
          npc.currentPlan.stepsRemaining--
          npc.lastActionTime = currentTime
          return action
        }
      } else {
        // Plan step failed - clear plan and re-plan
        npc.currentPlan = null
      }
    } else {
      // Plan expired or invalid - clear it
      npc.currentPlan = null
    }
  }

  // HUMAN-LIKE BEHAVIOR: Observation period
  // Humans pause briefly to observe before making decisions
  const OBSERVATION_TIME = 200 // 200ms observation period
  if (currentTime - npc.lastObservationTime < OBSERVATION_TIME && !EscapeHandler.isInDanger(npc)) {
    // Still observing - don't make new decisions yet (unless in danger)
    return null
  }

  // SENSE: build a perception snapshot from current world state
  const perception = sense(npc)

  // THINK: choose an action based on perception + behavior strategy
  const decision = think(npc, currentTime, perception)

  // HUMAN-LIKE BEHAVIOR: Create a plan from the decision
  // Instead of executing immediately, create a multi-step plan
  if (decision && decision.type === 'MOVE') {
    // Create a plan to move in this direction for several steps (humans commit to movement)
    const planSteps = PlanningHandler.calculatePlanSteps(npc, decision, perception)
    if (planSteps > 0) {
      npc.currentPlan = {
        type: 'MOVE',
        direction: decision.direction,
        stepsRemaining: planSteps,
        target: npc.currentTarget,
        createdAt: currentTime,
      }
      npc.planCreatedAt = currentTime
      npc.lastObservationTime = currentTime
      
      // Execute first step immediately
      const action = act(npc, decision)
      if (action) {
        npc.currentPlan.stepsRemaining--
        npc.lastActionTime = currentTime
        npc.lastMovementDirection = action.direction
        npc.movementMomentum = 1
        return action
      }
    }
  } else if (decision) {
    // For non-movement actions (BOMB, etc.), execute immediately but don't create a plan
    const action = act(npc, decision)
    if (action) {
      npc.lastActionTime = currentTime
      npc.lastObservationTime = currentTime
      // Clear movement plan when taking other actions
      if (action.type !== 'MOVE') {
        npc.currentPlan = null
      }
      return action
    }
  }

  // No action
  npc.lastObservationTime = currentTime
  return null
}

/**
 * SENSE phase of the AI loop.
 * Collects information about the current world and internal state.
 * @param {Object} npc - NPC instance
 * @returns {{ inDanger: boolean, hasNearbyPowerups: boolean, isStuck: boolean, strategy: Object }}
 */
function sense(npc) {
  // Ensure we have an active behavior strategy
  if (!npc.strategy) {
    npc.strategy = BehaviorStrategies.getStrategy(npc, npc.gameState || {})
  }

  const inDanger = EscapeHandler.isInDanger(npc)
  const hasNearbyPowerups = PowerupHandler.hasNearbyPowerups(npc)
  const isStuck = StuckDetector.isStuck(npc)

  return {
    inDanger,
    hasNearbyPowerups,
    isStuck,
    strategy: npc.strategy,
  }
}

/**
 * THINK phase of the AI loop.
 * Decides what to do based on perception and strategy.
 * @param {Object} npc - NPC instance
 * @param {number} currentTime
 * @param {{ inDanger: boolean, hasNearbyPowerups: boolean, isStuck: boolean, strategy: Object }} perception
 * @returns {Object|null} Raw decision/action object
 */
function think(npc, currentTime, perception) {
  const { inDanger, hasNearbyPowerups, isStuck, strategy } = perception

  // SPECIAL CASE: If we're adjacent to a block target (distance <= 1), we're not "stuck" - we should bomb it!
  // Skip stuck check when adjacent to block targets to allow bomb placement
  const isAdjacentToBlockTarget = npc.currentTarget?.type === 'block' && 
                                  Pathfinder.manhattanDistance(npc.position, npc.currentTarget) <= 1
  
  // Priority 1: Escape danger if in danger zone (ALWAYS highest priority, even over stuck check)
  // SPECIAL CASE: If we recently placed a bomb (within cooldown), prioritize escaping over everything else
  const BOMB_COOLDOWN = 2500 // 2.5 seconds (bombs explode after 3 seconds)
  const timeSinceLastBomb = Date.now() - npc.lastBombTime
  const recentlyPlacedBomb = timeSinceLastBomb < BOMB_COOLDOWN
  
  // IMPORTANT: Skip stuck check entirely when in danger - NPCs must escape first
  // This prevents oscillation and ensures NPCs continue escaping until safe
  if (inDanger) {
    const escapeAction = EscapeHandler.decideEscape(npc, npc.lastEscapeDirection)
    if (escapeAction) {
      // Track escape direction to prevent oscillation
      if (escapeAction.direction) {
        npc.lastEscapeDirection = escapeAction.direction
      }
      return escapeAction
    }
    // Escape failed
    if (recentlyPlacedBomb) {
      // If we just placed a bomb, we MUST escape - try again with more lenient checks
      const urgentEscapeAction = EscapeHandler.decideEscape(npc, npc.lastEscapeDirection, true) // allowLessSafe = true
      if (urgentEscapeAction) {
        // Track escape direction
        if (urgentEscapeAction.direction) {
          npc.lastEscapeDirection = urgentEscapeAction.direction
        }
        return urgentEscapeAction
      }
      // Still failed - but don't continue to other actions, escape is critical
      return null // Will try again next cycle
    }
    // Escape failed - if we're adjacent to a block target (but didn't just place a bomb), continue with other actions
    if (isAdjacentToBlockTarget) {
      // Continue to bomb placement/movement logic below
    } else {
      // Not adjacent to block target and escape failed - NPC is truly trapped
      return null
    }
  } else {
    // Clear escape direction and target when no longer in danger
    npc.lastEscapeDirection = null
    npc.escapeTarget = null
    
    // IMPORTANT: Keep targets after escaping - don't clear them!
    // NPCs should stick to their targets (especially players) until they place a bomb
    // Only re-evaluate if the current target is no longer valid
    if (npc.currentTarget && !TargetingHandler.isTargetValid(npc, npc.currentTarget)) {
      // Target is no longer valid (player died, block destroyed, etc.) - clear it
      npc.currentTarget = null
      npc.lastTargetSwitch = Date.now()
    }
    // Otherwise, keep the target - NPCs should commit to their goals!
    
    // Reset the flag tracking that we were in danger
    npc.wasInDangerLastCycle = false
  }
  
  // Track if we're currently in danger (for next cycle comparison)
  if (inDanger) {
    npc.wasInDangerLastCycle = true
    // Reset the cleared flag when entering danger (so we can clear target again after next escape)
    npc.hasClearedTargetAfterEscape = false
  }
  
  // Check for infinite loops and get unstuck if needed (ONLY if not in danger)
  // Skip stuck check when adjacent to block targets to allow bomb placement
  if (isStuck && !isAdjacentToBlockTarget) {
    const unstuckAction = StuckDetector.getUnstuck(npc)
    // If getUnstuck() returns null because NPC is safe and should resume normal behavior,
    // continue with normal decision-making instead of returning early
    if (unstuckAction !== null) {
      return unstuckAction
    }
    // Otherwise, continue with normal decision-making (don't return early)
  }

  // Priority 2: Collect powerups (based on strategy priority)
  if (strategy && strategy.targetPriority.powerups > 0.5 && hasNearbyPowerups) {
    const powerupAction = PowerupHandler.decideCollectPowerup(npc)
    if (powerupAction) {
      return powerupAction
    }
  }

  // Priority 3: Attack/place bomb (based on strategy and difficulty)
  // Bomb placement strategy:
  // - If adjacent to a block (obstacle), bomb it to clear the path toward our goal
  // - If player is in range, bomb to attack
  // - Otherwise, use normal bomb placement chance
  if (!strategy) {
    return null
  }
  
  const { hasPlayerTarget, hasBlockTarget } = BombingHandler.evaluateBombTargets(npc)
  
  // If we're adjacent to a block (either blocking our path or a target block), bomb it
  if (hasBlockTarget) {
    const bombAction = BombingHandler.decidePlaceBomb(npc, hasBlockTarget, hasPlayerTarget)
    if (bombAction) {
      return bombAction // Always try to bomb when adjacent to blocks
    }
  }
  
  // Otherwise, check normal bomb placement chance for attacking players
  let bombChance = strategy.bombPlacementChance * npc.profile.bombPlacementRate
  if (hasPlayerTarget) {
    bombChance = Math.min(1.0, bombChance * 1.5) // Boost chance when players nearby
  }
  
  if (Math.random() < bombChance) {
    const bombAction = BombingHandler.decidePlaceBomb(npc, hasBlockTarget, hasPlayerTarget)
    if (bombAction) return bombAction
  }

  // Priority 4: Move toward target (based on strategy)
  // BUT: Check post-explosion cooldown first to prevent stepping into blast zones
  const EXPLOSION_COOLDOWN = 2500 // Wait 2.5 seconds after explosions
  const timeSinceLastExplosion = Date.now() - npc.lastExplosionTime
  if (timeSinceLastExplosion < EXPLOSION_COOLDOWN) {
    // Still in post-explosion cooldown - don't move, stay put
    return null
  }
  
  const movementAction = MovementHandler.decideMovement(npc)
  if (movementAction) return movementAction

  // Priority 5: Opportunistic bombing (10% chance to bomb even without clear targets)
  // This helps NPCs be more active, especially in early game when paths are blocked
  if (Math.random() < 0.1) {
    const bombAction = BombingHandler.decidePlaceBomb(npc, hasBlockTarget, hasPlayerTarget)
    if (bombAction) return bombAction
  }

  // Priority 6: Wander (if strategy allows)
  if (Math.random() < strategy.wanderChance) {
    return MovementHandler.decideWander(npc)
  }

  // No action needed
  return null
}

/**
 * ACT phase of the AI loop.
 * Final place to clamp / validate / instrument actions before applying them.
 * For now this is a thin wrapper, but keeps the Sense–Think–Act structure explicit.
 * @param {Object} npc - NPC instance
 * @param {Object|null} decision
 * @returns {Object|null} Action to apply
 */
function act(npc, decision) {
  if (!decision) {
    return null
  }

  // Future hook: extra safety checks or logging could go here
  return decision
}

module.exports = {
  getNextCommand,
  sense,
  think,
  act
}
