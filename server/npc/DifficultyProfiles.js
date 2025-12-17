/**
 * Difficulty Profiles for NPCs
 * 
 * Defines the base profiles for Easy, Medium, and Hard difficulties.
 * These profiles act as multipliers and base values for NPC behavior.
 * 
 * Feature Flag: This module should be disabled for first review.
 */

const DifficultyProfiles = {
  /**
   * Easy Difficulty Profile
   * - Weak strategy, occasionally fails
   * - Low aggression, rarely places bombs
   * - Slower movement and decision-making
   */
  easy: {
    // Movement & Speed
    speed: 0.7,                    // 70% of normal speed
    movementDelay: 150,            // Random delay between movements (ms)
    
    // Decision-Making
    decisionInterval: 300,         // Makes decisions every 300ms
    reactionTime: 500,             // Reaction time to events (ms)
    
    // Aggression & Combat
    aggression: 0.3,              // 30% aggression level
    bombPlacementRate: 0.2,       // 20% chance to place bomb when opportunity arises
    chaseDistance: 3,              // Will chase players within 3 tiles
    attackRange: 2,                // Will attack players within 2 tiles
    
    // Success Rates
    mistakeRate: 0.3,             // 30% chance of making a mistake
    avoidanceSuccess: 0.85,       // 85% success at avoiding bombs
    bombPlacementSuccess: 0.6,    // 60% success at effective bomb placement
    
    // Powerup Behavior
    powerupPriority: 0.4,         // 40% priority for collecting powerups
    powerupChaseDistance: 2,      // Will chase powerups within 2 tiles
    
    // Strategy
    strategy: 'defensive',         // Prefers defensive play
    wanderChance: 0.3,            // 30% chance to wander randomly
    blockDestructionRate: 0.3,    // 30% chance to target destructible blocks
  },

  /**
   * Medium Difficulty Profile
   * - Good strategy, high chance of implementing plan
   * - Balanced aggression and caution
   * - Normal speed and decision-making
   */
  medium: {
    // Movement & Speed
    speed: 1.0,                    // 100% of normal speed
    movementDelay: 100,            // Random delay between movements (ms)
    
    // Decision-Making
    decisionInterval: 200,        // Makes decisions every 200ms
    reactionTime: 300,             // Reaction time to events (ms)
    
    // Aggression & Combat
    aggression: 0.6,              // 60% aggression level
    bombPlacementRate: 0.5,       // 50% chance to place bomb when opportunity arises
    chaseDistance: 5,              // Will chase players within 5 tiles
    attackRange: 3,                // Will attack players within 3 tiles
    
    // Success Rates
    mistakeRate: 0.15,            // 15% chance of making a mistake
    avoidanceSuccess: 0.95,       // 95% success at avoiding bombs
    bombPlacementSuccess: 0.8,    // 80% success at effective bomb placement
    
    // Powerup Behavior
    powerupPriority: 0.7,         // 70% priority for collecting powerups
    powerupChaseDistance: 4,      // Will chase powerups within 4 tiles
    
    // Strategy
    strategy: 'balanced',          // Balanced playstyle
    wanderChance: 0.1,            // 10% chance to wander randomly
    blockDestructionRate: 0.5,    // 50% chance to target destructible blocks
  },

  /**
   * Hard Difficulty Profile
   * - Awesome strategy, almost never fails
   * - High aggression, frequent bomb placement
   * - Faster movement and decision-making
   */
  hard: {
    // Movement & Speed
    speed: 1.3,                    // 130% of normal speed
    movementDelay: 50,             // Random delay between movements (ms)
    
    // Decision-Making
    decisionInterval: 100,        // Makes decisions every 100ms
    reactionTime: 150,             // Reaction time to events (ms)
    
    // Aggression & Combat
    aggression: 0.9,              // 90% aggression level
    bombPlacementRate: 0.8,       // 80% chance to place bomb when opportunity arises
    chaseDistance: 7,              // Will chase players within 7 tiles
    attackRange: 4,                // Will attack players within 4 tiles
    
    // Success Rates
    mistakeRate: 0.05,            // 5% chance of making a mistake
    avoidanceSuccess: 0.98,       // 98% success at avoiding bombs
    bombPlacementSuccess: 0.95,   // 95% success at effective bomb placement
    
    // Powerup Behavior
    powerupPriority: 0.95,        // 95% priority for collecting powerups
    powerupChaseDistance: 6,      // Will chase powerups within 6 tiles
    
    // Strategy
    strategy: 'aggressive',        // Aggressive playstyle
    wanderChance: 0.05,           // 5% chance to wander randomly
    blockDestructionRate: 0.7,    // 70% chance to target destructible blocks
  },
};

/**
 * Gets a difficulty profile by name
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {Object} Difficulty profile object
 */
function getDifficultyProfile(difficulty) {
  const normalized = difficulty.toLowerCase();
  return DifficultyProfiles[normalized] || DifficultyProfiles.medium;
}

/**
 * Validates if a difficulty level is valid
 * @param {string} difficulty - Difficulty level to validate
 * @returns {boolean}
 */
function isValidDifficulty(difficulty) {
  const normalized = difficulty.toLowerCase();
  return normalized in DifficultyProfiles;
}

module.exports = {
  DifficultyProfiles,
  getDifficultyProfile,
  isValidDifficulty,
};




