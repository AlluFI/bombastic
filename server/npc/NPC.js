/**
 * NPC (Non-Player Character) Controller
 * 
 * Represents a virtual opponent that mimics human player behavior.
 * NPCs are treated identically to human players except they cannot pause/quit.
 * 
 * Feature Flag: This entire module should be disabled for first review.
 */

const DangerDetector = require('./utils/DangerDetector');
const Pathfinder = require('./utils/Pathfinder');
const BehaviorStrategies = require('./BehaviorStrategies');

class NPC {
  /**
   * Creates a new NPC instance
   * @param {string} id - Unique NPC identifier
   * @param {string} name - Display name for the NPC
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @param {Object} config - Optional NPC configuration (strategy, speed, etc.)
   */
  constructor(id, name, difficulty = 'medium', config = {}) {
    this.id = id;
    this.name = name;
    this.difficulty = difficulty.toLowerCase();
    this.config = config;
    
    // NPC state
    this.position = { x: 0, y: 0 }; // Grid position
    this.alive = true;
    this.score = 0;
    this.lives = 1; // Default lives
    
    // NPC attributes (scaled by difficulty)
    this.profile = this._loadDifficultyProfile();
    
    // Internal state for decision-making
    this.lastActionTime = 0;
    this.currentTarget = null;
    this.path = [];
    this.dangerZones = new Set(); // Grid positions that are dangerous
    this.navigationGrid = null; // Cached navigation grid for pathfinding
    
    // Behavior state
    this.state = 'idle'; // 'idle' | 'moving' | 'escaping' | 'attacking' | 'collecting'
    this.strategy = null; // Current behavior strategy (set when gameState is available)
    
    // Infinite loop prevention
    this.lastPositions = []; // Track recent positions to detect loops
    this.positionHistorySize = 10; // How many positions to track
    this.stuckCounter = 0; // Counter for how long NPC has been stuck
    this.lastTargetSwitch = 0; // Time when target was last switched
    
    // Decision-making interval (ms) - varies by difficulty
    this.decisionInterval = this.profile.decisionInterval;
    
    // Grid dimensions (will be set from game state)
    this.maxRows = 11; // Default Bomberman grid
    this.maxCols = 13;
  }

  /**
   * Loads difficulty profile with multipliers
   * @returns {Object} Difficulty profile configuration
   */
  _loadDifficultyProfile() {
    const baseProfiles = {
      easy: {
        speed: 0.7,              // Slower movement
        decisionInterval: 300,   // Slower decisions (300ms)
        aggression: 0.3,         // Low aggression
        bombPlacementRate: 0.2,  // Rarely places bombs
        mistakeRate: 0.3,        // 30% chance of mistakes
        powerupPriority: 0.4,    // Low powerup priority
        avoidanceSuccess: 0.85,  // 85% success at avoiding bombs
      },
      medium: {
        speed: 1.0,              // Normal speed
        decisionInterval: 200,   // Normal decisions (200ms)
        aggression: 0.6,         // Moderate aggression
        bombPlacementRate: 0.5,  // Moderate bomb placement
        mistakeRate: 0.15,       // 15% chance of mistakes
        powerupPriority: 0.7,    // Moderate powerup priority
        avoidanceSuccess: 0.95,  // 95% success at avoiding bombs
      },
      hard: {
        speed: 1.3,              // Faster movement
        decisionInterval: 100,   // Fast decisions (100ms)
        aggression: 0.9,         // High aggression
        bombPlacementRate: 0.8,  // Frequent bomb placement
        mistakeRate: 0.05,       // 5% chance of mistakes
        powerupPriority: 0.95,   // High powerup priority
        avoidanceSuccess: 0.98,  // 98% success at avoiding bombs
      },
    };

    const base = baseProfiles[this.difficulty] || baseProfiles.medium;
    
    // Apply custom config overrides if provided
    return {
      ...base,
      ...this.config,
    };
  }

  /**
   * Updates NPC's internal world state representation
   * Called by server when game state changes
   * @param {Object} gameState - Current game state from server
   */
  updateWorldState(gameState) {
    // Update position if provided
    if (gameState.players) {
      const npcPlayer = gameState.players.find(p => p.id === this.id);
      if (npcPlayer) {
        this.position = { x: npcPlayer.x, y: npcPlayer.y };
        this.alive = npcPlayer.alive !== false;
        this.score = npcPlayer.score || 0;
        this.lives = npcPlayer.lives || 1;
      }
    }

    // Update grid dimensions if available
    if (gameState.board) {
      this.maxRows = gameState.board.length;
      this.maxCols = gameState.board[0] ? gameState.board[0].length : 13;
    }

    // Update navigation grid (for pathfinding)
    this._updateNavigationGrid(gameState);

    // Update danger zones from active bombs using DangerDetector
    if (gameState.bombs && gameState.bombs.length > 0 && gameState.board) {
      this.dangerZones = DangerDetector.calculateDangerZones(
        gameState.bombs,
        gameState.board,
        this.maxRows,
        this.maxCols
      );
    } else {
      this.dangerZones.clear();
    }

    // Store game state for decision-making
    this.gameState = gameState;
    
    // Update behavior strategy based on current game state
    this.strategy = BehaviorStrategies.getStrategy(this, gameState);
    
    // Track position history for loop detection
    this._updatePositionHistory();
  }

  /**
   * Updates navigation grid for pathfinding
   * Converts game board to pathfinding-friendly format
   * @param {Object} gameState - Current game state
   */
  _updateNavigationGrid(gameState) {
    if (!gameState.board) {
      return;
    }

    // Convert board to navigation grid
    // 0 = walkable, 1 = blocked (destructible block or wall), 2 = indestructible wall
    this.navigationGrid = gameState.board.map(row => 
      row.map(cell => {
        // 0 = walkable, 1 = destructible block, 2 = indestructible wall
        return cell === 0 ? 0 : 1; // Treat all non-walkable as blocked for pathfinding
      })
    );

    // Also mark positions with active explosions as blocked
    if (gameState.explosions) {
      gameState.explosions.forEach(explosion => {
        if (this.navigationGrid[explosion.y] && this.navigationGrid[explosion.y][explosion.x] !== undefined) {
          this.navigationGrid[explosion.y][explosion.x] = 1; // Blocked by explosion
        }
      });
    }
  }

  /**
   * Main decision-making method (Sense → Think → Act)
   * Returns the next action the NPC should take
   * @param {number} currentTime - Current timestamp (ms)
   * @returns {Object|null} Action object or null if no action needed
   */
  getNextCommand(currentTime) {
    // Check if enough time has passed since last decision
    if (currentTime - this.lastActionTime < this.decisionInterval) {
      return null;
    }

    // Don't act if dead
    if (!this.alive) {
      return null;
    }

    // Don't act if no game state available
    if (!this.gameState) {
      return null;
    }

    // SENSE: build a perception snapshot from current world state
    const perception = this._sense();

    // THINK: choose an action based on perception + behavior strategy
    const decision = this._think(currentTime, perception);

    // ACT: validate and return the chosen action
    const action = this._act(decision);
    
    if (action) {
      this.lastActionTime = currentTime;
    }

    return action;
  }

  /**
   * SENSE phase of the AI loop.
   * Collects information about the current world and internal state.
   * @returns {{ inDanger: boolean, hasNearbyPowerups: boolean, isStuck: boolean, strategy: Object }}
   */
  _sense() {
    // Ensure we have an active behavior strategy
    if (!this.strategy) {
      this.strategy = BehaviorStrategies.getStrategy(this, this.gameState || {});
    }

    const inDanger = this._isInDanger();
    const hasNearbyPowerups = this._hasNearbyPowerups();
    const isStuck = this._isStuck();

    return {
      inDanger,
      hasNearbyPowerups,
      isStuck,
      strategy: this.strategy,
    };
  }

  /**
   * THINK phase of the AI loop.
   * Decides what to do based on perception and strategy.
   * (This is the old _makeDecision logic, refactored.)
   * @param {number} currentTime
   * @param {{ inDanger: boolean, hasNearbyPowerups: boolean, isStuck: boolean, strategy: Object }} perception
   * @returns {Object|null} Raw decision/action object
   */
  _think(currentTime, perception) {
    const { inDanger, hasNearbyPowerups, isStuck, strategy } = perception;

    // Check for infinite loops and get unstuck if needed
    if (isStuck) {
      return this._getUnstuck();
    }

    // Priority 1: Escape danger if in danger zone (always highest priority)
    if (inDanger) {
      return this._decideEscape();
    }

    // Priority 2: Collect powerups (based on strategy priority)
    if (strategy.targetPriority.powerups > 0.5 && hasNearbyPowerups) {
      const powerupAction = this._decideCollectPowerup();
      if (powerupAction) return powerupAction;
    }

    // Priority 3: Attack/place bomb (based on strategy and difficulty)
    const bombChance = strategy.bombPlacementChance * this.profile.bombPlacementRate;
    if (Math.random() < bombChance) {
      const bombAction = this._decidePlaceBomb();
      if (bombAction) return bombAction;
    }

    // Priority 4: Move toward target (based on strategy)
    const movementAction = this._decideMovement();
    if (movementAction) return movementAction;

    // Priority 5: Wander (if strategy allows)
    if (Math.random() < strategy.wanderChance) {
      return this._decideWander();
    }

    // No action needed
    return null;
  }

  /**
   * ACT phase of the AI loop.
   * Final place to clamp / validate / instrument actions before applying them.
   * For now this is a thin wrapper, but keeps the Sense–Think–Act structure explicit.
   * @param {Object|null} decision
   * @returns {Object|null} Action to apply
   */
  _act(decision) {
    if (!decision) {
      return null;
    }

    // Future hook: extra safety checks or logging could go here
    return decision;
  }

  /**
   * Checks if NPC is currently in a danger zone
   * @returns {boolean}
   */
  _isInDanger() {
    const key = `${this.position.x},${this.position.y}`;
    return this.dangerZones.has(key);
  }

  /**
   * Decides escape action when in danger
   * Uses pathfinding to find nearest safe position
   * @returns {Object|null} Action object or null if no safe path
   */
  _decideEscape() {
    if (!this.navigationGrid || !this.gameState) {
      // Fallback to random direction if no grid available
      return this._getRandomSafeDirection();
    }

    // Find nearest safe position using DangerDetector
    const safePosition = DangerDetector.findNearestSafePosition(
      this.position,
      this.dangerZones,
      this.navigationGrid,
      this.maxRows,
      this.maxCols
    );

    if (!safePosition) {
      // No safe position found, try random safe direction
      return this._getRandomSafeDirection();
    }

    // Use pathfinding to get direction toward safe position
    const direction = Pathfinder.getNextDirection(
      this.position,
      safePosition,
      this.navigationGrid,
      this.maxRows,
      this.maxCols
    );

    if (direction) {
      // Verify the direction is actually safe
      const nextPos = this._getNextPosition(this.position, direction);
      if (!DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.state = 'escaping';
        return {
          type: 'MOVE',
          direction: direction,
        };
      }
    }

    // Fallback to random safe direction
    return this._getRandomSafeDirection();
  }

  /**
   * Gets a random safe direction (fallback when pathfinding fails)
   * @returns {Object|null} Action object or null
   */
  _getRandomSafeDirection() {
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const shuffled = directions.sort(() => Math.random() - 0.5);

    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      
      // Check if position is valid and safe
      if (this._isValidPosition(nextPos) && 
          !DangerDetector.isInDanger(nextPos, this.dangerZones) &&
          this._isWalkable(nextPos)) {
        this.state = 'escaping';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    // No safe direction found - NPC might be trapped
    // Return null to avoid moving into danger
    return null;
  }

  /**
   * Gets the next position after moving in a direction
   * @param {Object} pos - Current position { x, y }
   * @param {string} direction - 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
   * @returns {Object} Next position { x, y }
   */
  _getNextPosition(pos, direction) {
    const moves = {
      'UP': { x: 0, y: -1 },
      'DOWN': { x: 0, y: 1 },
      'LEFT': { x: -1, y: 0 },
      'RIGHT': { x: 1, y: 0 },
    };

    const move = moves[direction] || { x: 0, y: 0 };
    return {
      x: pos.x + move.x,
      y: pos.y + move.y,
    };
  }

  /**
   * Checks if a position is valid (within bounds)
   * @param {Object} pos - Position { x, y }
   * @returns {boolean}
   */
  _isValidPosition(pos) {
    return pos.x >= 0 && pos.x < this.maxCols && pos.y >= 0 && pos.y < this.maxRows;
  }

  /**
   * Checks if a position is walkable
   * @param {Object} pos - Position { x, y }
   * @returns {boolean}
   */
  _isWalkable(pos) {
    if (!this.navigationGrid || !this._isValidPosition(pos)) {
      return false;
    }
    return this.navigationGrid[pos.y] && this.navigationGrid[pos.y][pos.x] === 0;
  }

  /**
   * Decides if NPC should collect a nearby powerup
   * Uses ItemEvaluator to find best powerup
   * @returns {Object|null} Action object or null
   */
  _decideCollectPowerup() {
    if (!this.gameState || !this.gameState.powerups || this.gameState.powerups.length === 0) {
      return null;
    }

    // Use ItemEvaluator to find best powerup
    const ItemEvaluator = require('./utils/ItemEvaluator');
    const npcState = {
      position: this.position,
      score: this.score,
      lives: this.lives,
    };

    const bestPowerup = ItemEvaluator.findBestPowerup(
      this.gameState.powerups,
      npcState,
      this.strategy.targetPriority.powerups
    );

    if (!bestPowerup) {
      return null;
    }

    // Check if powerup is worth collecting (considering danger)
    if (!ItemEvaluator.isPowerupWorthCollecting(
      bestPowerup,
      npcState,
      this.dangerZones,
      this.strategy.targetPriority.powerups
    )) {
      return null;
    }

    // Pathfind toward powerup
    const direction = Pathfinder.getNextDirection(
      this.position,
      { x: bestPowerup.x, y: bestPowerup.y },
      this.navigationGrid,
      this.maxRows,
      this.maxCols
    );

    if (direction) {
      const nextPos = this._getNextPosition(this.position, direction);
      // Verify move is safe
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.currentTarget = { x: bestPowerup.x, y: bestPowerup.y, type: 'powerup' };
        this.state = 'collecting';
        return {
          type: 'MOVE',
          direction: direction,
        };
      }
    }

    return null;
  }

  /**
   * Decides if NPC should place a bomb
   * Includes safety checks to prevent suicide and basic target evaluation
   * @returns {Object|null} Action object or null
   */
  _decidePlaceBomb() {
    if (!this.gameState || !this.gameState.board) {
      return null;
    }

    // Safety check: Never place bomb if currently in danger
    if (this._isInDanger()) {
      return null;
    }

    // Safety check: Don't place a new bomb if another explosion is about to happen here
    const timeUntilExplosion = DangerDetector.getTimeUntilExplosion(this.position, this.gameState.bombs || []);
    if (timeUntilExplosion !== null && timeUntilExplosion < 1000) {
      return null;
    }

    // Evaluate whether there is any worthwhile target for bombing
    const { hasPlayerTarget, hasBlockTarget } = this._evaluateBombTargets();
    if (!hasPlayerTarget && !hasBlockTarget) {
      // No reason to bomb here
      return null;
    }

    // Simulate \"mistakes\" for easier difficulties: sometimes skip good bomb opportunities
    const successRoll = Math.random();
    if (successRoll > this.profile.bombPlacementSuccess) {
      return null;
    }

    // Safety check: Verify there's an escape route after placing bomb
    // This prevents NPC from trapping itself
    if (!this._hasEscapeRoute()) {
      // Hard difficulty might take calculated risks
      if (this.difficulty !== 'hard' || Math.random() > 0.3) {
        return null;
      }
    }

    // At this point we have a valid reason to bomb and an escape route
    this.state = 'attacking';
    return {
      type: 'BOMB',
    };
  }

  /**
   * Evaluates if there are good bomb targets nearby (players or destructible blocks)
   * Uses difficulty profile to determine ranges and priorities.
   * @returns {{ hasPlayerTarget: boolean, hasBlockTarget: boolean }}
   */
  _evaluateBombTargets() {
    let hasPlayerTarget = false;
    let hasBlockTarget = false;

    const board = this.gameState.board;
    const attackRange = this.profile.attackRange || 2;
    const blockDestructionRate = this.profile.blockDestructionRate || 0.3;

    // Check for player targets within attack range (Manhattan distance)
    if (this.gameState.players && this.gameState.players.length > 1) {
      for (const p of this.gameState.players) {
        if (p.id === this.id || p.alive === false) continue;
        const dist = Pathfinder.manhattanDistance(this.position, { x: p.x, y: p.y });
        if (dist > 0 && dist <= attackRange) {
          hasPlayerTarget = true;
          break;
        }
      }
    }

    // Check for nearby destructible blocks (for opening paths / finding powerups)
    // Only sometimes considered, depending on blockDestructionRate
    if (Math.random() < blockDestructionRate) {
      const maxRadius = attackRange + 1;
      for (let dy = -maxRadius; dy <= maxRadius; dy++) {
        for (let dx = -maxRadius; dx <= maxRadius; dx++) {
          const x = this.position.x + dx;
          const y = this.position.y + dy;
          if (!this._isValidPosition({ x, y })) continue;
          if (!board[y]) continue;
          if (board[y][x] === 1) { // 1 = destructible block
            hasBlockTarget = true;
            break;
          }
        }
        if (hasBlockTarget) break;
      }
    }

    return { hasPlayerTarget, hasBlockTarget };
  }

  /**
   * Checks if NPC has an escape route from current position
   * Used to prevent suicide bomb placements
   * @returns {boolean}
   */
  _hasEscapeRoute() {
    if (!this.navigationGrid) {
      return true; // Assume safe if no grid (fallback)
    }

    // Check if at least one adjacent position is safe and walkable
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const dir of directions) {
      const nextPos = this._getNextPosition(this.position, dir);
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Decides movement direction
   * Uses pathfinding to move toward target or explores safely
   * @returns {Object|null} Action object or null
   */
  _decideMovement() {
    // Select or update target based on strategy
    const target = this._selectTarget();
    
    if (target && this.navigationGrid) {
      const direction = Pathfinder.getNextDirection(
        this.position,
        target,
        this.navigationGrid,
        this.maxRows,
        this.maxCols
      );

      if (direction) {
        const nextPos = this._getNextPosition(this.position, direction);
        // Verify the move is safe
        if (this._isValidPosition(nextPos) && 
            this._isWalkable(nextPos) &&
            !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
          this.state = 'moving';
          return {
            type: 'MOVE',
            direction: direction,
          };
        }
      }
    }

    // No target or pathfinding failed - explore safely
    return this._decideSafeExploration();
  }

  /**
   * Decides safe exploration movement (when no specific target)
   * Avoids danger zones and blocked paths
   * @returns {Object|null} Action object or null
   */
  _decideSafeExploration() {
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const shuffled = directions.sort(() => Math.random() - 0.5);

    // Try to find a safe direction
    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.state = 'moving';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    // No safe direction found - stay put
    // (Better than moving into danger)
    return null;
  }

  /**
   * Updates position history for loop detection
   */
  _updatePositionHistory() {
    const posKey = `${this.position.x},${this.position.y}`;
    this.lastPositions.push(posKey);
    
    // Keep only recent positions
    if (this.lastPositions.length > this.positionHistorySize) {
      this.lastPositions.shift();
    }
  }

  /**
   * Checks if NPC is stuck in a loop
   * @returns {boolean}
   */
  _isStuck() {
    if (this.lastPositions.length < 5) {
      return false;
    }

    // Check if we've been in the same position too many times
    const currentPos = `${this.position.x},${this.position.y}`;
    const samePositionCount = this.lastPositions.filter(pos => pos === currentPos).length;
    
    if (samePositionCount >= 5) {
      this.stuckCounter++;
      return true;
    }

    // Check for circular movement pattern
    const uniquePositions = new Set(this.lastPositions);
    if (uniquePositions.size <= 3 && this.lastPositions.length >= 8) {
      this.stuckCounter++;
      return true;
    }

    // Reset stuck counter if not stuck
    this.stuckCounter = 0;
    return false;
  }

  /**
   * Gets unstuck by switching target or using fallback routine
   * @returns {Object|null} Action object
   */
  _getUnstuck() {
    // Switch target to break the loop
    this.currentTarget = null;
    this.lastTargetSwitch = Date.now();
    
    // Clear position history
    this.lastPositions = [];
    
    // Try to move in a completely different direction
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const shuffled = directions.sort(() => Math.random() - 0.5);
    
    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.state = 'moving';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    // If still stuck, try any walkable direction (even if not ideal)
    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      if (this._isValidPosition(nextPos) && this._isWalkable(nextPos)) {
        this.state = 'moving';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    return null;
  }

  /**
   * Selects a target based on strategy priorities
   * @returns {Object|null} Target object { x, y, type } or null
   */
  _selectTarget() {
    if (!this.strategy || !this.gameState) {
      return null;
    }

    const currentTime = Date.now();
    // Switch targets occasionally to avoid predictability
    const timeSinceSwitch = currentTime - this.lastTargetSwitch;
    const shouldSwitchTarget = timeSinceSwitch > 5000 || this.currentTarget === null;

    if (!shouldSwitchTarget && this.currentTarget) {
      // Keep current target if it's still valid
      if (this._isTargetValid(this.currentTarget)) {
        return this.currentTarget;
      }
    }

    const candidates = [];

    // Find player targets (based on strategy priority)
    if (this.strategy.targetPriority.players > 0.3 && this.gameState.players) {
      this.gameState.players.forEach(player => {
        if (player.id !== this.id && player.alive !== false) {
          const distance = Pathfinder.manhattanDistance(this.position, { x: player.x, y: player.y });
          if (distance <= this.strategy.chaseDistance) {
            candidates.push({
              x: player.x,
              y: player.y,
              type: 'player',
              priority: this.strategy.targetPriority.players,
              distance: distance,
            });
          }
        }
      });
    }

    // Find powerup targets (based on strategy priority)
    if (this.strategy.targetPriority.powerups > 0.3 && this.gameState.powerups) {
      this.gameState.powerups.forEach(powerup => {
        const distance = Pathfinder.manhattanDistance(this.position, { x: powerup.x, y: powerup.y });
        candidates.push({
          x: powerup.x,
          y: powerup.y,
          type: 'powerup',
          priority: this.strategy.targetPriority.powerups,
          distance: distance,
        });
      });
    }

    // Find block targets (for strategic bomb placement)
    if (this.strategy.targetPriority.blocks > 0.3 && this.gameState.board) {
      // Find nearby destructible blocks
      for (let y = Math.max(0, this.position.y - 3); y <= Math.min(this.maxRows - 1, this.position.y + 3); y++) {
        for (let x = Math.max(0, this.position.x - 3); x <= Math.min(this.maxCols - 1, this.position.x + 3); x++) {
          if (this.gameState.board[y] && this.gameState.board[y][x] === 1) { // Destructible block
            const distance = Pathfinder.manhattanDistance(this.position, { x, y });
            if (distance <= 4) {
              candidates.push({
                x: x,
                y: y,
                type: 'block',
                priority: this.strategy.targetPriority.blocks,
                distance: distance,
              });
            }
          }
        }
      }
    }

    // Select best target based on priority and distance
    if (candidates.length === 0) {
      return null;
    }

    // Score candidates: priority * (1 / distance) - closer and higher priority is better
    candidates.forEach(candidate => {
      candidate.score = candidate.priority * (10 / (candidate.distance + 1));
    });

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    // Select top candidate (with some randomness for diversity)
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    this.currentTarget = selected;
    this.lastTargetSwitch = currentTime;

    return selected;
  }

  /**
   * Checks if a target is still valid
   * @param {Object} target - Target object
   * @returns {boolean}
   */
  _isTargetValid(target) {
    if (!target || !this.gameState) {
      return false;
    }

    switch (target.type) {
      case 'player':
        const player = this.gameState.players.find(p => p.id !== this.id && p.x === target.x && p.y === target.y);
        return player && player.alive !== false;
      case 'powerup':
        return this.gameState.powerups && 
               this.gameState.powerups.some(p => p.x === target.x && p.y === target.y);
      case 'block':
        return this.gameState.board && 
               this.gameState.board[target.y] && 
               this.gameState.board[target.y][target.x] === 1;
      default:
        return false;
    }
  }

  /**
   * Decides wander movement (random exploration)
   * @returns {Object|null} Action object
   */
  _decideWander() {
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const shuffled = directions.sort(() => Math.random() - 0.5);

    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.state = 'moving';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    return null;
  }

  /**
   * Checks if there are nearby powerups
   * @returns {boolean}
   */
  _hasNearbyPowerups() {
    // TODO: Implement in PART 5 (Power-Up Logic)
    // For now, check if gameState has powerups
    if (!this.gameState || !this.gameState.powerups || this.gameState.powerups.length === 0) {
      return false;
    }

    // Check if any powerup is within reasonable distance
    const maxDistance = 5;
    return this.gameState.powerups.some(powerup => {
      const distance = Pathfinder.manhattanDistance(this.position, { x: powerup.x, y: powerup.y });
      return distance <= maxDistance;
    });
  }

  /**
   * Resets NPC state (for new game)
   */
  reset() {
    this.position = { x: 0, y: 0 };
    this.alive = true;
    this.score = 0;
    this.lives = 1;
    this.lastActionTime = 0;
    this.currentTarget = null;
    this.path = [];
    this.dangerZones.clear();
    this.navigationGrid = null;
    this.state = 'idle';
    this.strategy = null;
    this.lastPositions = [];
    this.stuckCounter = 0;
    this.lastTargetSwitch = 0;
  }
}

module.exports = NPC;

