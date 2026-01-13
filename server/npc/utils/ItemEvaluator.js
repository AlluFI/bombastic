/**
 * Item Evaluation Utilities for NPCs
 * 
 * Helps NPCs evaluate and prioritize powerups and other items on the map.
 * 
 * Feature Flag: This module should be disabled for first review.
 */

class ItemEvaluator {
  /**
   * Evaluates the value of a powerup for an NPC
   * @param {Object} powerup - Powerup object { x, y, type }
   * @param {Object} npcState - Current NPC state (position, stats, etc.)
   * @param {number} priority - NPC's powerup priority (0-1)
   * @returns {number} Value score (higher = more valuable)
   */
  static evaluatePowerup(powerup, npcState, priority) {
    if (!powerup || !npcState) {
      return 0;
    }

    // Base value by powerup type
    const baseValues = {
      'bomb_range': 8,    // Increases explosion range - very valuable
      'bomb_count': 7,    // Increases max bombs - very valuable
      'immortal': 6,       // Temporary invincibility - valuable but time-limited
    };

    const baseValue = baseValues[powerup.type] || 1;

    // Distance factor (closer = more valuable, but not linearly)
    const distance = this._manhattanDistance(npcState.position, { x: powerup.x, y: powerup.y });
    const distanceFactor = Math.max(0, 10 - distance); // Decreases with distance

    // Priority multiplier
    const priorityMultiplier = priority;

    // Calculate final value
    const value = baseValue * distanceFactor * priorityMultiplier;

    return value;
  }

  /**
   * Finds the best powerup to collect
   * @param {Array<Object>} powerups - Array of powerup objects
   * @param {Object} npcState - Current NPC state
   * @param {number} priority - NPC's powerup priority
   * @returns {Object|null} Best powerup object or null if none
   */
  static findBestPowerup(powerups, npcState, priority) {
    if (!powerups || powerups.length === 0) {
      return null;
    }

    let bestPowerup = null;
    let bestValue = 0;

    powerups.forEach(powerup => {
      const value = this.evaluatePowerup(powerup, npcState, priority);
      if (value > bestValue) {
        bestValue = value;
        bestPowerup = powerup;
      }
    });

    return bestPowerup;
  }

  /**
   * Calculates Manhattan distance between two points
   * @param {Object} a - { x, y } position
   * @param {Object} b - { x, y } position
   * @returns {number}
   */
  static _manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Checks if a powerup is worth collecting (considering danger)
   * @param {Object} powerup - Powerup object
   * @param {Object} npcState - Current NPC state
   * @param {Set<string>} dangerZones - Set of danger zone keys
   * @param {number} priority - NPC's powerup priority
   * @returns {boolean}
   */
  static isPowerupWorthCollecting(powerup, npcState, dangerZones, priority) {
    if (!powerup) {
      return false;
    }

    // Check if powerup is in a danger zone
    const powerupKey = `${powerup.x},${powerup.y}`;
    if (dangerZones.has(powerupKey)) {
      // Only collect if high priority and NPC is confident
      return priority > 0.8;
    }

    // Evaluate value
    const value = this.evaluatePowerup(powerup, npcState, priority);
    return value > 5; // Threshold for worth collecting
  }
}

module.exports = ItemEvaluator;




