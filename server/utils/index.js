/**
 * Utilities Module Index
 * Re-exports all utility functions from sub-modules
 * 
 * This allows importing from '../utils' or '../utils.js' while
 * maintaining the modular structure internally.
 */

const roomUtils = require('./room-utils')
const boardUtils = require('./board-utils')
const gameStateUtils = require('./game-state-utils')
const npcUtils = require('./npc-utils')
const deltaUpdates = require('./delta-updates')

module.exports = {
  // Room utilities
  ...roomUtils,
  
  // Board utilities
  ...boardUtils,
  
  // Game state utilities
  ...gameStateUtils,
  
  // NPC utilities
  ...npcUtils,
  
  // Delta update utilities
  ...deltaUpdates
}
