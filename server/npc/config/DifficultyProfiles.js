/**
 * NPC Difficulty Profiles
 * 
 * Defines difficulty-specific attributes for NPCs.
 * Each difficulty level has different decision intervals, mistake rates, and attack ranges.
 */

/**
 * Base difficulty profiles
 * @type {Object}
 */
const DIFFICULTY_PROFILES = {
  easy: {
    decisionInterval: 500,   // Controls decision-making frequency
    bombPlacementRate: 0.2,  // Multiplied with strategy bomb placement chance
    mistakeRate: 0.3,        // Converts to bombPlacementSuccess (1 - mistakeRate)
    attackRange: 2,          // Maximum distance to consider players as bomb targets
  },
  medium: {
    decisionInterval: 400,   // Controls decision-making frequency
    bombPlacementRate: 0.5,  // Multiplied with strategy bomb placement chance
    mistakeRate: 0.15,       // Converts to bombPlacementSuccess (1 - mistakeRate)
    attackRange: 3,          // Maximum distance to consider players as bomb targets
  },
  hard: {
    decisionInterval: 300,   // Controls decision-making frequency
    bombPlacementRate: 0.8,  // Multiplied with strategy bomb placement chance
    mistakeRate: 0.05,       // Converts to bombPlacementSuccess (1 - mistakeRate)
    attackRange: 4,          // Maximum distance to consider players as bomb targets
  },
}

/**
 * Loads a difficulty profile with config overrides
 * @param {string} difficulty - Difficulty level ('easy' | 'medium' | 'hard')
 * @param {Object} config - Optional config overrides
 * @returns {Object} Difficulty profile configuration
 */
function loadDifficultyProfile(difficulty, config = {}) {
  const base = DIFFICULTY_PROFILES[difficulty.toLowerCase()] || DIFFICULTY_PROFILES.medium
  
  // Calculate bombPlacementSuccess from mistakeRate (1 - mistakeRate)
  // This represents how often NPCs successfully execute bomb placement decisions
  const bombPlacementSuccess = 1 - base.mistakeRate
  
  // Apply custom config overrides if provided
  return {
    ...base,
    bombPlacementSuccess,  // Add bombPlacementSuccess to profile
    ...config,
  }
}

/**
 * Gets a difficulty profile by name
 * @param {string} difficulty - Difficulty level
 * @returns {Object|null} Difficulty profile or null if invalid
 */
function getDifficultyProfile(difficulty) {
  if (!difficulty) return null
  return DIFFICULTY_PROFILES[difficulty.toLowerCase()] || null
}

/**
 * Checks if a difficulty level is valid
 * @param {string} difficulty - Difficulty level to check
 * @returns {boolean} True if valid
 */
function isValidDifficulty(difficulty) {
  if (!difficulty || typeof difficulty !== 'string') return false
  return difficulty.toLowerCase() in DIFFICULTY_PROFILES
}

module.exports = {
  DIFFICULTY_PROFILES,
  loadDifficultyProfile,
  getDifficultyProfile,
  isValidDifficulty
}
