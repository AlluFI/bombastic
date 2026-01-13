/**
 * NPC Behavior Strategies
 * 
 * Defines different AI strategies that NPCs can use:
 * - Aggressive: Focuses on attacking players
 * - Defensive: Focuses on survival and avoiding danger
 * - Balanced: Mix of offensive and defensive play
 * 
 * Feature Flag: This module should be disabled for first review.
 */

class BehaviorStrategies {
  /**
   * Aggressive Strategy
   * - High priority on attacking players
   * - Frequent bomb placement
   * - Chases players actively
   * - Takes calculated risks
   */
  static aggressive(npc, gameState) {
    const strategy = {
      name: 'aggressive',
      targetPriority: {
        players: 0.9,      // High priority on players
        powerups: 0.3,      // Low priority on powerups
        blocks: 0.5,        // Moderate priority on blocks
      },
      bombPlacementChance: 0.7,  // High chance to place bombs
      chaseDistance: 6,          // Will chase players from far away
      riskTolerance: 0.4,         // Willing to take some risks
      wanderChance: 0.05,         // Rarely wanders randomly
    };

    return strategy;
  }

  /**
   * Defensive Strategy
   * - High priority on survival
   * - Avoids danger zones
   * - Rarely places bombs
   * - Keeps distance from players
   */
  static defensive(npc, gameState) {
    const strategy = {
      name: 'defensive',
      targetPriority: {
        players: 0.2,      // Low priority on players
        powerups: 0.5,      // Moderate priority on powerups
        blocks: 0.3,        // Low priority on blocks
      },
      bombPlacementChance: 0.2,  // Low chance to place bombs
      chaseDistance: 2,          // Only chases nearby players
      riskTolerance: 0.1,         // Very risk-averse
      wanderChance: 0.3,          // Often wanders to avoid conflict
    };

    return strategy;
  }

  /**
   * Balanced Strategy
   * - Mix of offensive and defensive
   * - Moderate bomb placement
   * - Balanced priorities
   */
  static balanced(npc, gameState) {
    const strategy = {
      name: 'balanced',
      targetPriority: {
        players: 0.6,      // Moderate priority on players
        powerups: 0.6,      // Moderate priority on powerups
        blocks: 0.5,        // Moderate priority on blocks
      },
      bombPlacementChance: 0.8,  // Increased chance to place bombs (was 0.5)
      chaseDistance: 4,          // Moderate chase distance
      riskTolerance: 0.3,         // Moderate risk tolerance
      wanderChance: 0.15,         // Occasional wandering
    };

    return strategy;
  }

  /**
   * Gets strategy based on difficulty and optional strategy name
   * @param {NPC} npc - NPC instance
   * @param {Object} gameState - Current game state
   * @returns {Object} Strategy object
   */
  static getStrategy(npc, gameState) {
    // If strategy is specified in config, use it
    if (npc.config && npc.config.strategy) {
      const strategyName = npc.config.strategy.toLowerCase();
      switch (strategyName) {
        case 'aggressive':
          return this.aggressive(npc, gameState);
        case 'defensive':
          return this.defensive(npc, gameState);
        case 'balanced':
          return this.balanced(npc, gameState);
        default:
          // Fall back to difficulty-based strategy
          break;
      }
    }

    // Default strategy based on difficulty
    switch (npc.difficulty) {
      case 'easy':
        // Easy NPCs are more defensive
        return this.defensive(npc, gameState);
      case 'medium':
        // Medium NPCs are balanced
        return this.balanced(npc, gameState);
      case 'hard':
        // Hard NPCs are aggressive
        return this.aggressive(npc, gameState);
      default:
        return this.balanced(npc, gameState);
    }
  }
}

module.exports = BehaviorStrategies;




