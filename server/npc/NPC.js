/**
 * NPC (Non-Player Character) Controller
 * 
 * Represents a virtual opponent that mimics human player behavior.
 * NPCs are treated identically to human players except they cannot pause/quit.
 * 
 * This class now uses modular behavior handlers for better organization.
 */

const NPCState = require('./core/NPCState')
const DecisionLoop = require('./core/DecisionLoop')
const DifficultyProfiles = require('./config/DifficultyProfiles')

class NPC {
  /**
   * Creates a new NPC instance
   * @param {string} id - Unique NPC identifier
   * @param {string} name - Display name for the NPC
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @param {Object} config - Optional NPC configuration (strategy, speed, etc.)
   */
  constructor(id, name, difficulty = 'medium', config = {}) {
    this.id = id
    this.name = name
    this.difficulty = difficulty.toLowerCase()
    this.config = config
    
    // NPC state
    this.position = { x: 0, y: 0 } // Grid position
    this.alive = true
    this.score = 0
    this.lives = 3 // Default lives (matching players)
    
    // NPC attributes (scaled by difficulty)
    this.profile = DifficultyProfiles.loadDifficultyProfile(this.difficulty, this.config)
    
    // Internal state for decision-making
    this.lastActionTime = 0
    this.currentTarget = null
    this.path = []
    this.dangerZones = new Set() // Grid positions that are dangerous
    this.navigationGrid = null // Cached navigation grid for pathfinding
    this.gameState = null // Current game state snapshot
    
    // Behavior state
    this.state = 'idle' // 'idle' | 'moving' | 'escaping' | 'attacking' | 'collecting'
    this.strategy = null // Current behavior strategy (set when gameState is available)
    this.lastEscapeDirection = null // Last direction NPC moved while escaping (to prevent oscillation)
    
    // Infinite loop prevention
    this.lastPositions = [] // Track recent positions to detect loops
    this.positionHistorySize = 10 // How many positions to track
    this.stuckCounter = 0 // Counter for how long NPC has been stuck
    this.lastTargetSwitch = 0 // Time when target was last switched
    this.lastBombTime = 0 // Time when NPC last placed a bomb (cooldown tracking)
    this._pathfindingRecursionDepth = 0 // Prevent infinite recursion in pathfinding
    this.escapeTarget = null // Target safe position NPC is escaping toward (persists until safe)
    this.lastExplosionTime = 0 // Time when a nearby bomb last exploded (for post-explosion wait)
    this.committedDirection = null // Direction NPC is committed to moving in (prevents oscillation)
    this.committedDirectionUntil = 0 // Timestamp until which NPC is committed to this direction
    this.hasClearedTargetAfterEscape = false // Track if we've already cleared target after escaping (prevents oscillation)
    this.wasInDangerLastCycle = false // Track if NPC was in danger last cycle (to detect transition from danger to safe)
    
    // Human-like behavior: Planning and momentum
    this.currentPlan = null // Current multi-step plan { type: 'MOVE'|'BOMB'|'ESCAPE', direction: string, stepsRemaining: number, target: Object }
    this.planCreatedAt = 0 // When the current plan was created
    this.lastObservationTime = 0 // Last time NPC paused to observe (human-like pause)
    this.movementMomentum = 0 // Number of consecutive moves in same direction (humans continue moving)
    this.lastMovementDirection = null // Last direction moved (for momentum)
    
    // Decision-making interval (ms) - varies by difficulty
    this.decisionInterval = this.profile.decisionInterval
    
    // Grid dimensions (will be set from game state)
    // Default to match client grid: 13 rows × 15 cols
    this.maxRows = 13 // Match client GRID_ROWS
    this.maxCols = 15 // Match client GRID_COLS
  }

  /**
   * Updates NPC's internal world state representation
   * Called by server when game state changes
   * @param {Object} gameState - Current game state from server
   */
  updateWorldState(gameState) {
    NPCState.updateWorldState(this, gameState)
  }

  /**
   * Main decision-making method (Sense → Think → Act)
   * Returns the next action the NPC should take
   * @param {number} currentTime - Current timestamp (ms)
   * @returns {Object|null} Action object or null if no action needed
   */
  getNextCommand(currentTime) {
    return DecisionLoop.getNextCommand(this, currentTime)
  }

  /**
   * Resets NPC state (for new game)
   */
  reset() {
    NPCState.reset(this)
  }
}

module.exports = NPC
