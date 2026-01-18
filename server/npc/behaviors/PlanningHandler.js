/**
 * Planning Behavior Handler
 * 
 * Handles multi-step planning for NPC movement.
 * Implements human-like commitment to movement plans.
 */

const Pathfinder = require('../utils/Pathfinder')
const DangerDetector = require('../utils/DangerDetector')
const PositionHelpers = require('../utils/PositionHelpers')
const EscapeHandler = require('./EscapeHandler')

/**
 * Checks if the current plan is still valid
 * @param {Object} npc - NPC instance
 * @param {Object} plan - Plan object
 * @returns {boolean}
 */
function isPlanValid(npc, plan) {
  if (!plan) return false
  
  // If in danger, escape plans take priority
  if (EscapeHandler.isInDanger(npc) && plan.type !== 'ESCAPE') {
    return false
  }
  
  // Check if the next step in the plan is still valid
  if (plan.type === 'MOVE') {
    const nextPos = PositionHelpers.getNextPosition(npc.position, plan.direction)
    if (!PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) || 
        !PositionHelpers.isWalkable(npc, nextPos)) {
      return false
    }
    // Don't move into danger unless escaping
    if (DangerDetector.isInDanger(nextPos, npc.dangerZones) && !EscapeHandler.isInDanger(npc)) {
      return false
    }
  }
  
  return true
}

/**
 * Executes one step of the current plan
 * @param {Object} npc - NPC instance
 * @param {Object} plan - Plan object
 * @returns {Object|null} Action object or null
 */
function executePlanStep(npc, plan) {
  if (!plan || plan.stepsRemaining <= 0) {
    return null
  }
  
  if (plan.type === 'MOVE') {
    const nextPos = PositionHelpers.getNextPosition(npc.position, plan.direction)
    if (PositionHelpers.isValidPosition(nextPos, npc.maxRows, npc.maxCols) && 
        PositionHelpers.isWalkable(npc, nextPos)) {
      // CRITICAL: Always check for danger before moving
      // Only allow moving into danger if we're currently in danger and trying to escape
      const nextPosInDanger = DangerDetector.isInDanger(nextPos, npc.dangerZones)
      const currentlyInDanger = EscapeHandler.isInDanger(npc)
      
      // Never move into danger unless we're already in danger and escaping
      if (!nextPosInDanger || (currentlyInDanger && npc.state === 'escaping')) {
        return {
          type: 'MOVE',
          direction: plan.direction,
        }
      } else {
        // Plan step would move into danger - cancel plan and escape instead
        npc.currentPlan = null
        return null
      }
    }
  }
  
  return null
}

/**
 * Calculates how many steps to plan ahead (human-like commitment)
 * @param {Object} npc - NPC instance
 * @param {Object} decision - Decision object
 * @param {Object} perception - Perception object
 * @returns {number} Number of steps to plan
 */
function calculatePlanSteps(npc, decision, perception) {
  if (decision.type !== 'MOVE') {
    return 0 // Only plan movement steps
  }
  
  // Humans commit to movement for several steps
  // More steps if:
  // - Moving toward a clear target
  // - Not in danger
  // - Has momentum (already moving in this direction)
  
  let steps = 1 // Minimum 1 step
  
  if (npc.currentTarget) {
    // Moving toward a target - commit for more steps
    const distance = Pathfinder.manhattanDistance(npc.position, npc.currentTarget)
    if (distance > 3) {
      steps = 3 // Far target - commit to 3 steps
    } else if (distance > 1) {
      steps = 2 // Medium distance - commit to 2 steps
    }
  }
  
  // Momentum bonus - if already moving in this direction, continue longer
  if (npc.movementMomentum > 0 && decision.direction === npc.lastMovementDirection) {
    steps += Math.min(2, npc.movementMomentum) // Up to 2 extra steps for momentum
  }
  
  // Reduce steps if in danger (humans are more cautious)
  if (perception.inDanger) {
    steps = Math.min(steps, 1) // Only 1 step when in danger
  }
  
  return Math.min(steps, 5) // Cap at 5 steps (humans don't plan too far ahead)
}

module.exports = {
  isPlanValid,
  executePlanStep,
  calculatePlanSteps
}
