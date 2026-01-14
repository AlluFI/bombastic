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
    this.lives = 3; // Default lives (matching players)
    
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
    this.lastEscapeDirection = null; // Last direction NPC moved while escaping (to prevent oscillation)
    
    // Infinite loop prevention
    this.lastPositions = []; // Track recent positions to detect loops
    this.positionHistorySize = 10; // How many positions to track
    this.stuckCounter = 0; // Counter for how long NPC has been stuck
    this.lastTargetSwitch = 0; // Time when target was last switched
    this.lastBombTime = 0; // Time when NPC last placed a bomb (cooldown tracking)
    this._pathfindingRecursionDepth = 0; // Prevent infinite recursion in pathfinding
    this.escapeTarget = null; // Target safe position NPC is escaping toward (persists until safe)
    this.lastExplosionTime = 0; // Time when a nearby bomb last exploded (for post-explosion wait)
    this.committedDirection = null; // Direction NPC is committed to moving in (prevents oscillation)
    this.committedDirectionUntil = 0; // Timestamp until which NPC is committed to this direction
    this.hasClearedTargetAfterEscape = false; // Track if we've already cleared target after escaping (prevents oscillation)
    this.wasInDangerLastCycle = false; // Track if NPC was in danger last cycle (to detect transition from danger to safe)
    
    // Human-like behavior: Planning and momentum
    this.currentPlan = null; // Current multi-step plan { type: 'MOVE'|'BOMB'|'ESCAPE', direction: string, stepsRemaining: number, target: Object }
    this.planCreatedAt = 0; // When the current plan was created
    this.lastObservationTime = 0; // Last time NPC paused to observe (human-like pause)
    this.movementMomentum = 0; // Number of consecutive moves in same direction (humans continue moving)
    this.lastMovementDirection = null; // Last direction moved (for momentum)
    
    // Decision-making interval (ms) - varies by difficulty
    this.decisionInterval = this.profile.decisionInterval;
    
    // Grid dimensions (will be set from game state)
    // Default to match client grid: 13 rows × 15 cols
    this.maxRows = 13; // Match client GRID_ROWS
    this.maxCols = 15; // Match client GRID_COLS
  }

  /**
   * Loads difficulty profile with multipliers
   * @returns {Object} Difficulty profile configuration
   */
  _loadDifficultyProfile() {
    const baseProfiles = {
      easy: {
        speed: 0.7,              // Slower movement
        decisionInterval: 500,   // Slower decisions (500ms - humans think slower)
        aggression: 0.3,         // Low aggression
        bombPlacementRate: 0.2,  // Rarely places bombs
        mistakeRate: 0.3,        // 30% chance of mistakes
        powerupPriority: 0.4,    // Low powerup priority
        avoidanceSuccess: 0.85,  // 85% success at avoiding bombs
      },
      medium: {
        speed: 1.0,              // Normal speed
        decisionInterval: 400,   // Normal decisions (400ms - more human-like)
        aggression: 0.6,         // Moderate aggression
        bombPlacementRate: 0.5,  // Moderate bomb placement
        mistakeRate: 0.15,       // 15% chance of mistakes
        powerupPriority: 0.7,    // Moderate powerup priority
        avoidanceSuccess: 0.95,  // 95% success at avoiding bombs
      },
      hard: {
        speed: 1.3,              // Faster movement
        decisionInterval: 300,   // Fast decisions (300ms - still human-like, not superhuman)
        aggression: 0.9,         // High aggression
        bombPlacementRate: 0.8,  // Frequent bomb placement
        mistakeRate: 0.05,       // 5% chance of mistakes
        powerupPriority: 0.95,   // High powerup priority
        avoidanceSuccess: 0.98,  // 98% success at avoiding bombs
      },
    };

    const base = baseProfiles[this.difficulty] || baseProfiles.medium;
    
    // Calculate bombPlacementSuccess from mistakeRate (1 - mistakeRate)
    // This represents how often NPCs successfully execute bomb placement decisions
    const bombPlacementSuccess = 1 - base.mistakeRate;
    
    // Apply custom config overrides if provided
    return {
      ...base,
      bombPlacementSuccess,  // Add bombPlacementSuccess to profile
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
        this.lives = npcPlayer.lives || 3;
      }
    }

    // Update grid dimensions if available
    if (gameState.board) {
      this.maxRows = gameState.board.length;
      this.maxCols = gameState.board[0] ? gameState.board[0].length : 15;
    } else {
      // If no board, use default dimensions matching client grid
      // Client grid is 13 rows × 15 cols
      this.maxRows = 13;
      this.maxCols = 15;
    }

    // Update navigation grid (for pathfinding)
    this._updateNavigationGrid(gameState);

    // Track if bombs exploded (bombs removed from gameState)
    const previousBombCount = this.gameState?.bombs?.length || 0;
    const currentBombCount = gameState.bombs?.length || 0;
    if (previousBombCount > currentBombCount) {
      // Bombs exploded - update explosion time for cooldown
      this.lastExplosionTime = Date.now();
    }
    
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

    // Mark positions with active bombs as blocked (bombs block movement)
    if (gameState.bombs && gameState.bombs.length > 0) {
      gameState.bombs.forEach(bomb => {
        // Grid is structured as grid[row][col], and x=row, y=col
        if (this.navigationGrid[bomb.x] && this.navigationGrid[bomb.x][bomb.y] !== undefined) {
          this.navigationGrid[bomb.x][bomb.y] = 1; // Blocked by bomb
        }
      });
    }

    // Also mark positions with active explosions as blocked
    if (gameState.explosions) {
      gameState.explosions.forEach(explosion => {
        // Grid is structured as grid[row][col], and x=row, y=col
        if (this.navigationGrid[explosion.x] && this.navigationGrid[explosion.x][explosion.y] !== undefined) {
          this.navigationGrid[explosion.x][explosion.y] = 1; // Blocked by explosion
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

    // CRITICAL: Always check for danger FIRST - escape takes priority over plans/commitments
    // NPCs should never move into danger zones unless they're already in danger and escaping
    const currentlyInDanger = this._isInDanger();
    
    // HUMAN-LIKE BEHAVIOR: Execute existing plan if valid
    // Humans make a plan and execute it, not constantly re-evaluate
    // BUT: Only if not in immediate danger from other NPCs' bombs
    if (this.currentPlan && this.currentPlan.stepsRemaining > 0 && !currentlyInDanger) {
      const planAge = currentTime - this.planCreatedAt;
      const maxPlanAge = 5000; // Plans expire after 5 seconds (humans adapt)
      
      // Check if plan is still valid
      if (planAge < maxPlanAge && this._isPlanValid(this.currentPlan)) {
        // Execute next step of the plan
        const action = this._executePlanStep(this.currentPlan);
        if (action) {
          // Double-check that the action doesn't move into danger
          if (action.type === 'MOVE') {
            const nextPos = this._getNextPosition(this.position, action.direction);
            const nextPosInDanger = DangerDetector.isInDanger(nextPos, this.dangerZones);
            if (nextPosInDanger && !currentlyInDanger) {
              // Plan would move into danger - cancel plan and escape instead
              this.currentPlan = null;
              // Fall through to normal decision-making (which will handle escape)
            } else {
              this.currentPlan.stepsRemaining--;
              this.lastActionTime = currentTime;
              
              // Track momentum (humans continue in same direction)
              if (action.direction === this.lastMovementDirection) {
                this.movementMomentum++;
              } else {
                this.movementMomentum = 1;
                this.lastMovementDirection = action.direction;
              }
              
              return action;
            }
          } else {
            // Non-movement action - execute it
            this.currentPlan.stepsRemaining--;
            this.lastActionTime = currentTime;
            return action;
          }
        } else {
          // Plan step failed - clear plan and re-plan
          this.currentPlan = null;
        }
      } else {
        // Plan expired or invalid - clear it
        this.currentPlan = null;
      }
    }

    // HUMAN-LIKE BEHAVIOR: Observation period
    // Humans pause briefly to observe before making decisions
    const OBSERVATION_TIME = 200; // 200ms observation period
    if (currentTime - this.lastObservationTime < OBSERVATION_TIME && !this._isInDanger()) {
      // Still observing - don't make new decisions yet (unless in danger)
      return null;
    }

    // SENSE: build a perception snapshot from current world state
    const perception = this._sense();

    // THINK: choose an action based on perception + behavior strategy
    const decision = this._think(currentTime, perception);

    // HUMAN-LIKE BEHAVIOR: Create a plan from the decision
    // Instead of executing immediately, create a multi-step plan
    if (decision && decision.type === 'MOVE') {
      // Create a plan to move in this direction for several steps (humans commit to movement)
      const planSteps = this._calculatePlanSteps(decision, perception);
      if (planSteps > 0) {
        this.currentPlan = {
          type: 'MOVE',
          direction: decision.direction,
          stepsRemaining: planSteps,
          target: this.currentTarget,
          createdAt: currentTime,
        };
        this.planCreatedAt = currentTime;
        this.lastObservationTime = currentTime;
        
        // Execute first step immediately
        const action = this._act(decision);
        if (action) {
          this.currentPlan.stepsRemaining--;
          this.lastActionTime = currentTime;
          this.lastMovementDirection = action.direction;
          this.movementMomentum = 1;
          return action;
        }
      }
    } else if (decision) {
      // For non-movement actions (BOMB, etc.), execute immediately but don't create a plan
      const action = this._act(decision);
      if (action) {
        this.lastActionTime = currentTime;
        this.lastObservationTime = currentTime;
        // Clear movement plan when taking other actions
        if (action.type !== 'MOVE') {
          this.currentPlan = null;
        }
        return action;
      }
    }

    // No action
    this.lastObservationTime = currentTime;
    return null;
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

    // SPECIAL CASE: If we're adjacent to a block target (distance <= 1), we're not "stuck" - we should bomb it!
    // Skip stuck check when adjacent to block targets to allow bomb placement
    const isAdjacentToBlockTarget = this.currentTarget?.type === 'block' && 
                                    Pathfinder.manhattanDistance(this.position, this.currentTarget) <= 1;
    
    // Priority 1: Escape danger if in danger zone (ALWAYS highest priority, even over stuck check)
    // SPECIAL CASE: If we recently placed a bomb (within cooldown), prioritize escaping over everything else
    const BOMB_COOLDOWN = 2500; // 2.5 seconds (bombs explode after 3 seconds)
    const timeSinceLastBomb = Date.now() - this.lastBombTime;
    const recentlyPlacedBomb = timeSinceLastBomb < BOMB_COOLDOWN;
    
    // IMPORTANT: Skip stuck check entirely when in danger - NPCs must escape first
    // This prevents oscillation and ensures NPCs continue escaping until safe
    if (inDanger) {
      const escapeAction = this._decideEscape(this.lastEscapeDirection);
      if (escapeAction) {
        // Track escape direction to prevent oscillation
        if (escapeAction.direction) {
          this.lastEscapeDirection = escapeAction.direction;
        }
        return escapeAction;
      }
      // Escape failed
      if (recentlyPlacedBomb) {
        // If we just placed a bomb, we MUST escape - try again with more lenient checks
        const urgentEscapeAction = this._decideEscape(this.lastEscapeDirection, true); // allowLessSafe = true
        if (urgentEscapeAction) {
          // Track escape direction
          if (urgentEscapeAction.direction) {
            this.lastEscapeDirection = urgentEscapeAction.direction;
          }
          return urgentEscapeAction;
        }
        // Still failed - but don't continue to other actions, escape is critical
        return null; // Will try again next cycle
      }
      // Escape failed - if we're adjacent to a block target (but didn't just place a bomb), continue with other actions
      if (isAdjacentToBlockTarget) {
        // Continue to bomb placement/movement logic below
      } else {
        // Not adjacent to block target and escape failed - NPC is truly trapped
        return null;
      }
    } else {
      // Clear escape direction and target when no longer in danger
      this.lastEscapeDirection = null;
      this.escapeTarget = null;
      
      // IMPORTANT: Keep targets after escaping - don't clear them!
      // NPCs should stick to their targets (especially players) until they place a bomb
      // Only re-evaluate if the current target is no longer valid
      if (this.currentTarget && !this._isTargetValid(this.currentTarget)) {
        // Target is no longer valid (player died, block destroyed, etc.) - clear it
        this.currentTarget = null;
        this.lastTargetSwitch = Date.now();
      }
      // Otherwise, keep the target - NPCs should commit to their goals!
      
      // Reset the flag tracking that we were in danger
      this.wasInDangerLastCycle = false;
    }
    
    // Track if we're currently in danger (for next cycle comparison)
    if (inDanger) {
      this.wasInDangerLastCycle = true;
      // Reset the cleared flag when entering danger (so we can clear target again after next escape)
      this.hasClearedTargetAfterEscape = false;
    }
    
    // Check for infinite loops and get unstuck if needed (ONLY if not in danger)
    // Skip stuck check when adjacent to block targets to allow bomb placement
    if (isStuck && !isAdjacentToBlockTarget) {
      const unstuckAction = this._getUnstuck();
      // If _getUnstuck() returns null because NPC is safe and should resume normal behavior,
      // continue with normal decision-making instead of returning early
      if (unstuckAction !== null) {
        return unstuckAction;
      }
      // Otherwise, continue with normal decision-making (don't return early)
    }

    // Priority 2: Collect powerups (based on strategy priority)
    if (strategy && strategy.targetPriority.powerups > 0.5 && hasNearbyPowerups) {
      const powerupAction = this._decideCollectPowerup();
      if (powerupAction) {
        return powerupAction;
      }
    }

    // Priority 3: Attack/place bomb (based on strategy and difficulty)
    // Bomb placement strategy:
    // - If adjacent to a block (obstacle), bomb it to clear the path toward our goal
    // - If player is in range, bomb to attack
    // - Otherwise, use normal bomb placement chance
    if (!strategy) {
      return null;
    }
    
    const { hasPlayerTarget, hasBlockTarget } = this._evaluateBombTargets();
    
    // If we're adjacent to a block (either blocking our path or a target block), bomb it
    if (hasBlockTarget) {
      const bombAction = this._decidePlaceBomb(hasBlockTarget, hasPlayerTarget);
      if (bombAction) {
        return bombAction; // Always try to bomb when adjacent to blocks
      }
    }
    
    // Otherwise, check normal bomb placement chance for attacking players
    let bombChance = strategy.bombPlacementChance * this.profile.bombPlacementRate;
    if (hasPlayerTarget) {
      bombChance = Math.min(1.0, bombChance * 1.5); // Boost chance when players nearby
    }
    
    if (Math.random() < bombChance) {
      const bombAction = this._decidePlaceBomb(hasBlockTarget, hasPlayerTarget);
      if (bombAction) return bombAction;
    }

    // Priority 4: Move toward target (based on strategy)
    // BUT: Check post-explosion cooldown first to prevent stepping into blast zones
    const EXPLOSION_COOLDOWN = 2500; // Wait 2.5 seconds after explosions
    const timeSinceLastExplosion = Date.now() - this.lastExplosionTime;
    if (timeSinceLastExplosion < EXPLOSION_COOLDOWN) {
      // Still in post-explosion cooldown - don't move, stay put
      return null;
    }
    
    const movementAction = this._decideMovement();
    if (movementAction) return movementAction;

    // Priority 5: Opportunistic bombing (10% chance to bomb even without clear targets)
    // This helps NPCs be more active, especially in early game when paths are blocked
    if (Math.random() < 0.1) {
      const bombAction = this._decidePlaceBomb(hasBlockTarget, hasPlayerTarget);
      if (bombAction) return bombAction;
    }

    // Priority 6: Wander (if strategy allows)
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
   * @param {string|null} preferredDirection - Preferred direction to continue escaping (prevents oscillation)
   * @param {boolean} allowLessSafe - If true, allow moving to less-safe positions (when we MUST escape)
   * @returns {Object|null} Action object or null if no safe path
   */
  _decideEscape(preferredDirection = null, allowLessSafe = false) {
    if (!this.navigationGrid || !this.gameState) {
      // Fallback to random direction if no grid available
      return this._getRandomSafeDirection(preferredDirection, allowLessSafe);
    }

    // IMPORTANT: If we're already at a safe position, clear the escape target and return null
    // This prevents oscillation when NPCs reach safety
    // BUT: Also check if there are bombs that will explode soon - NPCs should wait until bombs fully explode
    const currentPosKey = `${this.position.x},${this.position.y}`;
    const currentlyInDanger = this.dangerZones.has(currentPosKey);
    
    // Check if there are any bombs nearby that haven't exploded yet
    // NPCs should wait until all nearby bombs have fully exploded (removed from gameState.bombs) before moving
    // We check if bombs exist in gameState.bombs - if they're still there, they haven't exploded yet
    let hasNearbyActiveBombs = false;
    if (this.gameState && this.gameState.bombs && this.gameState.bombs.length > 0) {
      const now = Date.now();
      hasNearbyActiveBombs = this.gameState.bombs.some(bomb => {
        // Check if bomb is nearby (within explosion range + safety margin)
        const distance = Pathfinder.manhattanDistance(this.position, { x: bomb.x, y: bomb.y });
        const range = bomb.range || 2;
        const safetyMargin = 2; // Extra tiles to wait before considering it safe
        if (distance > range + safetyMargin) {
          // Bomb is far away, not a concern
          return false;
        }
        
        // If bomb is still in gameState.bombs, it hasn't exploded yet - wait!
        // Bombs are removed from gameState.bombs when they explode
        return true;
      });
    }
    
    if (!currentlyInDanger && !hasNearbyActiveBombs) {
      // We're safe and no nearby bombs are active - but wait a bit after explosions before moving
      const EXPLOSION_COOLDOWN = 2500; // Wait 2.5 seconds after explosions before moving again (increased to prevent stepping into blast zones)
      const timeSinceLastExplosion = Date.now() - this.lastExplosionTime;
      if (timeSinceLastExplosion < EXPLOSION_COOLDOWN) {
        // Still in post-explosion cooldown - stay put
        return null;
      }
      
      // We're safe and no nearby bombs are active - clear escape target and allow normal behavior
      this.escapeTarget = null;
      return null;
    }

    // If we already have an escape target and we're still in danger, keep moving toward it
    // This prevents oscillation by committing to one escape route
    let safePosition = this.escapeTarget;
    
    // Verify the escape target is still valid (safe and reachable)
    if (safePosition) {
      // Check if we've already reached the escape target (within 1 tile)
      const distanceToTarget = Pathfinder.manhattanDistance(this.position, safePosition);
      if (distanceToTarget <= 1) {
        // We're very close to or at the escape target - check if it's safe
        const targetKey = `${safePosition.x},${safePosition.y}`;
        if (!this.dangerZones.has(targetKey)) {
          // Target is safe and we're close - clear it so we don't oscillate
          this.escapeTarget = null;
          safePosition = null;
        }
      } else {
        // Still moving toward target - verify it's still valid
        const targetKey = `${safePosition.x},${safePosition.y}`;
        const targetStillSafe = !this.dangerZones.has(targetKey);
        const targetStillReachable = this._isValidPosition(safePosition) && 
                                      this.navigationGrid[safePosition.x] && 
                                      this.navigationGrid[safePosition.x][safePosition.y] === 0;
        
        if (!targetStillSafe || !targetStillReachable) {
          // Escape target is no longer valid, find a new one
          this.escapeTarget = null;
          safePosition = null;
        }
      }
    }
    
    // If no valid escape target, find a new one
    if (!safePosition) {
      safePosition = DangerDetector.findNearestSafePosition(
        this.position,
        this.dangerZones,
        this.navigationGrid,
        this.maxRows,
        this.maxCols
      );
      
      if (safePosition) {
        // Store the escape target so we commit to this route
        this.escapeTarget = safePosition;
      }
    }

    if (!safePosition) {
      // No safe position found, try random safe direction
      return this._getRandomSafeDirection(preferredDirection, allowLessSafe);
    }

    // Use pathfinding to get direction toward safe position
    // IMPORTANT: If we have a preferred direction (from last step), prefer it to prevent oscillation
    // This ensures NPCs continue moving in the same direction toward the escape target
    let direction = null;
    
    if (preferredDirection) {
      // We have a preferred direction - check if it's still valid and moves us closer to safety
      const preferredNextPos = this._getNextPosition(this.position, preferredDirection);
      if (this._isValidPosition(preferredNextPos) && this._isWalkable(preferredNextPos)) {
        const preferredDist = Pathfinder.manhattanDistance(preferredNextPos, safePosition);
        const currentDist = Pathfinder.manhattanDistance(this.position, safePosition);
        if (preferredDist < currentDist) {
          // Preferred direction is valid and moves us closer to safety - use it!
          direction = preferredDirection;
        }
      }
    }
    
    // If no preferred direction or it's not valid, use pathfinding
    if (!direction) {
      direction = Pathfinder.getNextDirection(
        this.position,
        safePosition,
        this.navigationGrid,
        this.maxRows,
        this.maxCols
      );
    }

    if (direction) {
      // Always move toward the safe position if we found one using pathfinding
      // Even if the next step is still in danger, it's moving us closer to safety
      // (this prevents oscillation - we commit to moving toward the safe position)
      const nextPos = this._getNextPosition(this.position, direction);
      
      // Check if position is walkable (we'll move even if still in danger if allowLessSafe is true)
      if (this._isValidPosition(nextPos) && this._isWalkable(nextPos)) {
        const nextPosInDanger = DangerDetector.isInDanger(nextPos, this.dangerZones);
        
        // Only move if: (1) next position is safe, OR (2) allowLessSafe is true AND we have a safe target
        if (!nextPosInDanger || (allowLessSafe && safePosition)) {
          this.state = 'escaping';
          
          // If we're moving to a safe position (not in danger), and it's our escape target, clear the target
          // This prevents oscillation when NPCs reach safety
          if (!nextPosInDanger && safePosition && Pathfinder.manhattanDistance(nextPos, safePosition) <= 1) {
            this.escapeTarget = null;
          }
          
          return {
            type: 'MOVE',
            direction: direction,
          };
        }
      }
    }

    // Fallback to random safe direction (pass preferredDirection to prevent oscillation)
    return this._getRandomSafeDirection(preferredDirection, allowLessSafe);
  }

  /**
   * Gets a random safe direction (fallback when pathfinding fails)
   * Tries to find a safe direction, but if none exists, tries the "best available" direction
   * @param {string|null} preferredDirection - Preferred direction to continue escaping (prevents oscillation)
   * @param {boolean} allowLessSafe - If true, allow moving to less-safe positions (when we MUST escape)
   * @returns {Object|null} Action object or null
   */
  _getRandomSafeDirection(preferredDirection = null, allowLessSafe = false) {
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    // If we have a preferred direction, try it first to prevent oscillation
    let shuffled;
    if (preferredDirection && directions.includes(preferredDirection)) {
      shuffled = [preferredDirection, ...directions.filter(d => d !== preferredDirection)];
    } else {
      shuffled = directions.sort(() => Math.random() - 0.5);
    }

    // First, try to find a perfectly safe direction
    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      
      // Check if position is valid, walkable, and safe
      if (this._isValidPosition(nextPos) && 
          this._isWalkable(nextPos) &&
          !DangerDetector.isInDanger(nextPos, this.dangerZones)) {
        this.state = 'escaping';
        return {
          type: 'MOVE',
          direction: dir,
        };
      }
    }

    // No perfectly safe direction found
    // If allowLessSafe is true, we MUST escape (e.g., after placing a bomb)
    // In this case, use pathfinding to find the nearest safe position (even if it's multiple steps away)
    if (allowLessSafe && this.navigationGrid && this.gameState) {
      const safePosition = DangerDetector.findNearestSafePosition(
        this.position,
        this.dangerZones,
        this.navigationGrid,
        this.maxRows,
        this.maxCols
      );
      
      if (safePosition) {
        // Use pathfinding to get direction toward safe position
        const direction = Pathfinder.getNextDirection(
          this.position,
          safePosition,
          this.navigationGrid,
          this.maxRows,
          this.maxCols
        );
        
        if (direction) {
          const nextPos = this._getNextPosition(this.position, direction);
          // Even if next position is in danger, move toward the safe position
          // (this helps NPCs escape corners where all adjacent positions are in danger)
          if (this._isValidPosition(nextPos) && this._isWalkable(nextPos)) {
            this.state = 'escaping';
            return {
              type: 'MOVE',
              direction: direction,
            };
          }
        }
      }
    }
    
    // No safe position found - return null and wait
    // NPCs will try again in the next cycle (danger zones might have changed)
    return null;
  }

  /**
   * Gets the next position after moving in a direction
   * @param {Object} pos - Current position { x, y }
   * @param {string} direction - 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
   * @returns {Object} Next position { x, y }
   */
  _getNextPosition(pos, direction) {
    // Coordinate system: x = row (vertical), y = col (horizontal)
    // UP = decrease x (move up in rows), DOWN = increase x (move down in rows)
    // LEFT = decrease y (move left in cols), RIGHT = increase y (move right in cols)
    const moves = {
      'UP': { x: -1, y: 0 },    // Move up = decrease row
      'DOWN': { x: 1, y: 0 },   // Move down = increase row
      'LEFT': { x: 0, y: -1 },  // Move left = decrease col
      'RIGHT': { x: 0, y: 1 },  // Move right = increase col
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
    // Coordinate system: x = row (0 to maxRows-1), y = col (0 to maxCols-1)
    // Grid is 13 rows (0-12) × 15 cols (0-14)
    return pos.x >= 0 && pos.x < this.maxRows && pos.y >= 0 && pos.y < this.maxCols;
  }

  /**
   * Checks if a position is walkable
   * @param {Object} pos - Position { x, y }
   * @returns {boolean}
   */
  _isWalkable(pos) {
    if (!this._isValidPosition(pos)) {
      return false;
    }
    
      // Check if there's a bomb at this position (bombs block movement)
      if (this.gameState && this.gameState.bombs && this.gameState.bombs.length > 0) {
        const hasBomb = this.gameState.bombs.some(bomb => bomb.x === pos.x && bomb.y === pos.y);
        if (hasBomb) {
          return false; // Bomb blocks movement
        }
      }
    
    // Check if there's another player or NPC at this position (players/NPCs block movement)
    // IMPORTANT: Only check ALIVE players - dead players don't block movement
    if (this.gameState && this.gameState.players && this.gameState.players.length > 0) {
      const hasPlayer = this.gameState.players.some(p => 
        p.id !== this.id && 
        p.alive === true && // Explicitly check for true (only alive players block)
        p.x === pos.x && 
        p.y === pos.y &&
        p.x >= 0 && p.y >= 0 // Also exclude off-board positions (-1, -1)
      );
      if (hasPlayer) {
        return false; // Another player/NPC blocks movement
      }
    }
    
    // Prefer navigation grid if available (more efficient, already processed)
    // BUT: Double-check bombs here too (defensive check in case gameState.bombs was stale)
    if (this.navigationGrid) {
      // Grid is structured as grid[row][col], and x=row, y=col
      // Navigation grid value: 0 = walkable, 1 = blocked (including bombs)
      const gridValue = this.navigationGrid[pos.x] && this.navigationGrid[pos.x][pos.y];
      
      // Defensive check: if navigation grid says it's walkable (0), but there's a bomb in gameState, block it
      if (gridValue === 0 && this.gameState && this.gameState.bombs && this.gameState.bombs.length > 0) {
        const hasBomb = this.gameState.bombs.some(bomb => bomb.x === pos.x && bomb.y === pos.y);
        if (hasBomb) {
          // Navigation grid says walkable but there's a bomb - block it!
          return false;
        }
      }
      
      return gridValue === 0;
    }
    
    // Fallback: check board directly if navigation grid doesn't exist
    // This handles cases where navigation grid wasn't created but board exists
    if (this.gameState && this.gameState.board) {
      // Grid is structured as grid[row][col], and x=row, y=col
      // 0 = walkable, 1 = destructible block, 2 = indestructible wall
      const row = this.gameState.board[pos.x];
      if (!row) return false;
      const cell = row[pos.y];
      // Only walkable if cell is 0 (explicitly walkable), block any blocks or walls
      return cell === 0;
    }
    
    // If no board information at all, allow movement as fallback
    // Note: Board is now generated on server, so this should rarely happen
    return true;
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
   * @param {boolean} hasBlockTarget - Whether NPC is adjacent to a block (passed from _think to avoid recalculation)
   * @param {boolean} hasPlayerTarget - Whether NPC has a player target in range (passed from _think to avoid recalculation)
   * @returns {Object|null} Action object or null
   */
  _decidePlaceBomb(hasBlockTarget = false, hasPlayerTarget = false) {
    if (!this.gameState || !this.gameState.board) {
      return null;
    }

    // If we weren't passed the target info, evaluate it now
    if (hasBlockTarget === false && hasPlayerTarget === false) {
      const targets = this._evaluateBombTargets();
      hasBlockTarget = targets.hasBlockTarget;
      hasPlayerTarget = targets.hasPlayerTarget;
    }

    if (!hasPlayerTarget && !hasBlockTarget) {
      // No reason to bomb here
      return null;
    }

    // CRITICAL: If we're adjacent to ANY block, prioritize bombing it
    // This ensures NPCs place bombs to clear paths, even if they're currently targeting a player
    // Check this FIRST before other safety checks (except immediate explosion danger)
    if (hasBlockTarget) {
      // Safety check: Don't place a new bomb if another explosion is about to happen here
      const timeUntilExplosion = DangerDetector.getTimeUntilExplosion(this.position, this.gameState.bombs || []);
      if (timeUntilExplosion !== null && timeUntilExplosion < 1000) {
        return null;
      }
      
      // When adjacent to blocks, be very lenient with cooldown
      // Allow bombing if cooldown is almost done (< 1000ms remaining) or if it's been a while
      const BOMB_COOLDOWN = 2500; // 2.5 seconds
      const timeSinceLastBomb = Date.now() - this.lastBombTime;
      const cooldownRemaining = BOMB_COOLDOWN - timeSinceLastBomb;
      
      // If cooldown is almost done (< 1000ms remaining), allow bombing blocks
      // This prevents NPCs from getting stuck waiting when they need to clear paths
      if (timeSinceLastBomb < BOMB_COOLDOWN && cooldownRemaining > 1000) {
        // Still in cooldown and more than 1000ms remaining - wait a bit longer
        return null;
      }
      
      // Place bomb when adjacent to blocks - bypass other safety checks
      // This ensures NPCs place bombs when adjacent to blocks, regardless of current target or danger
      this.state = 'attacking';
      this.lastBombTime = Date.now(); // Track when bomb was placed
      return {
        type: 'BOMB',
      };
    }

    // For non-block targets, apply normal safety checks
    // Safety check: Never place bomb if currently in danger
    if (this._isInDanger()) {
      return null;
    }

    // Safety check: Don't place a new bomb if another explosion is about to happen here
    const timeUntilExplosion = DangerDetector.getTimeUntilExplosion(this.position, this.gameState.bombs || []);
    if (timeUntilExplosion !== null && timeUntilExplosion < 1000) {
      return null;
    }

    // Bomb cooldown: Don't place another bomb too soon after placing one
    // This gives NPCs time to escape after placing a bomb
    const BOMB_COOLDOWN = 2500; // 2.5 seconds (bombs explode after 3 seconds)
    const timeSinceLastBomb = Date.now() - this.lastBombTime;
    if (timeSinceLastBomb < BOMB_COOLDOWN) {
      // Still in cooldown - prioritize escaping instead of placing another bomb
      return null;
    }

    // For other situations, apply normal safety checks
    // Simulate \"mistakes\" for easier difficulties: sometimes skip good bomb opportunities
    // But be more lenient when bombing blocks (NPCs need to clear paths to move)
    let successThreshold = this.profile.bombPlacementSuccess || (1 - (this.profile.mistakeRate || 0.15));
    if (!hasPlayerTarget && hasBlockTarget) {
      // Increase success rate when bombing blocks (reduce mistakes)
      successThreshold = Math.min(1.0, successThreshold + 0.2);
    }
    const successRoll = Math.random();
    if (successRoll > successThreshold) {
      return null;
    }

    // Safety check: Verify there's an escape route after placing bomb
    // This prevents NPC from trapping itself
    // But be more lenient for medium difficulty when bombing blocks
    if (!this._hasEscapeRoute()) {
      // When bombing blocks (not players), be more willing to take risks
      if (!hasPlayerTarget && hasBlockTarget) {
        if (this.difficulty === 'hard' && Math.random() < 0.5) {
          // Hard NPCs take risks to clear blocks
        } else if (this.difficulty === 'medium' && Math.random() < 0.3) {
          // Medium NPCs sometimes take risks
        } else {
          return null;
        }
      } else {
        // For player targets, be more cautious
        if (this.difficulty !== 'hard' || Math.random() > 0.3) {
          return null;
        }
      }
    }

    // At this point we have a valid reason to bomb and an escape route
    this.state = 'attacking';
    this.lastBombTime = Date.now(); // Track when bomb was placed
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

    if (!this.gameState || !this.gameState.board) {
      return { hasPlayerTarget: false, hasBlockTarget: false };
    }

    const board = this.gameState.board;
    const attackRange = this.profile.attackRange || 2;

    // Check for player targets within attack range (Manhattan distance)
    // OR if we're currently targeting a player (even if beyond immediate attack range)
    if (this.currentTarget?.type === 'player') {
      // We have a player target - check if they're still valid and within reasonable range
      const targetPlayer = this.gameState.players?.find(p => p.id === this.currentTarget.playerId);
      if (targetPlayer && targetPlayer.alive) {
        const dist = Pathfinder.manhattanDistance(this.position, { x: targetPlayer.x, y: targetPlayer.y });
        // If player is within attack range, we can bomb them
        // If player is further away, we're still targeting them (moving towards them)
        if (dist <= attackRange) {
          hasPlayerTarget = true;
        } else {
          // Player is beyond attack range but we're targeting them - still consider it a player target
          // This helps NPCs know they're pursuing a player even if not in immediate bombing range
          hasPlayerTarget = true;
        }
      }
    }
    
    // Also check for any other players within attack range (for opportunistic bombing)
    if (!hasPlayerTarget && this.gameState.players && this.gameState.players.length > 1) {
      for (const p of this.gameState.players) {
        if (p.id === this.id || p.alive === false) continue;
        const dist = Pathfinder.manhattanDistance(this.position, { x: p.x, y: p.y });
        if (dist > 0 && dist <= attackRange) {
          hasPlayerTarget = true;
          break;
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
    ];
    
    for (const dir of directions) {
      const x = this.position.x + dir.x;
      const y = this.position.y + dir.y;
      if (!this._isValidPosition({ x, y })) {
        continue;
      }
      // Grid is structured as grid[row][col], and x=row, y=col
      if (!board[x]) {
        continue;
      }
      const cellValue = board[x][y];
      if (cellValue === 1) { // 1 = destructible block (adjacent to NPC)
        hasBlockTarget = true;
        break;
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
    // CRITICAL: Check committed direction FIRST - before any other logic
    // This prevents oscillation by making NPCs stick to a direction until blocked or target reached
    const now = Date.now();
    if (this.committedDirection && now < this.committedDirectionUntil) {
      const committedNextPos = this._getNextPosition(this.position, this.committedDirection);
      // Only check if valid and walkable - allow moving even if in danger if we're committed
      // (NPCs should continue in their committed direction unless truly blocked)
      if (this._isValidPosition(committedNextPos) && this._isWalkable(committedNextPos)) {
        // Continue in committed direction (prevents oscillation)
        // Check danger only as a secondary concern - commitment is primary
        const nextPosInDanger = DangerDetector.isInDanger(committedNextPos, this.dangerZones);
        if (!nextPosInDanger) {
          return {
            type: 'MOVE',
            direction: this.committedDirection,
          };
        } else {
          // Committed direction leads to danger - wait until safe or clear commitment
          return null; // Wait instead of moving into danger
        }
      } else {
        // Committed direction is blocked - clear it and recalculate
        this.committedDirection = null;
        this.committedDirectionUntil = 0;
      }
    }
    
    // Select or update target based on strategy
    const target = this._selectTarget();
    
    // If we're already adjacent to a block target, don't move - we should bomb it instead
    // (This prevents oscillation when adjacent to blocks)
    if (target?.type === 'block') {
      const distance = Pathfinder.manhattanDistance(this.position, target);
      if (distance <= 1) {
        // Already adjacent - don't move, wait for bomb placement decision
        return null;
      }
    }
    
    if (target && this.navigationGrid) {
      // If target is a block, find nearest walkable position adjacent to it
      // (since blocks are not walkable, we can't pathfind directly to them)
      let pathfindingTarget = target;
      if (target.type === 'block') {
        // Find nearest walkable position adjacent to the block
        const adjacentPositions = [
          { x: target.x - 1, y: target.y }, // UP
          { x: target.x + 1, y: target.y }, // DOWN
          { x: target.x, y: target.y - 1 }, // LEFT
          { x: target.x, y: target.y + 1 }, // RIGHT
        ];
        
        // Find the closest walkable adjacent position
        let closestAdjacent = null;
        let closestDistance = Infinity;
        for (const adj of adjacentPositions) {
          if (this._isValidPosition(adj) && this._isWalkable(adj)) {
            const dist = Pathfinder.manhattanDistance(this.position, adj);
            if (dist < closestDistance) {
              closestDistance = dist;
              closestAdjacent = adj;
            }
          }
        }
        
        if (closestAdjacent) {
          pathfindingTarget = closestAdjacent;
        } else {
          // No walkable adjacent position found, skip this target
          return this._decideSafeExploration();
        }
      }
      
      // Use pathfinding when navigation grid is available
      const direction = Pathfinder.getNextDirection(
        this.position,
        pathfindingTarget,
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
          
          // Commit to this direction - longer for trappers with far-away targets
          let commitmentDuration = 4000; // Default 4 seconds
          if (this.strategy.name === 'trapper' && target && target.type === 'player') {
            const distance = Pathfinder.manhattanDistance(this.position, target);
            if (distance > 5) {
              // Far-away target - commit longer to prevent oscillation
              commitmentDuration = 8000; // 8 seconds for far targets
            }
          }
          
          this.committedDirection = direction;
          this.committedDirectionUntil = Date.now() + commitmentDuration;
          
          return {
            type: 'MOVE',
            direction: direction,
          };
        }
      } else {
        // Pathfinding failed - target might be unreachable due to blocks
        // If target is a player and we can't reach them, find a blocking block
        if (target.type === 'player' && !this._pathfindingRecursionDepth) {
          // For trappers with far-away players, use intermediate block finding
          if (this.strategy.name === 'trapper') {
            const distance = Pathfinder.manhattanDistance(this.position, target);
            const chaseDistance = this.strategy.chaseDistance || 3;
            
            if (distance > chaseDistance + 2) {
              // Player is far away - find intermediate block
              const player = this.gameState.players.find(p => 
                p.id === target.playerId || 
                (Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1)
              );
              if (player) {
                const intermediateBlock = this._findIntermediateBlockTowardPlayer(player);
                if (intermediateBlock) {
                  this.currentTarget = intermediateBlock;
                  this.currentTarget.intermediateForPlayer = player.id;
                  // Don't reset lastTargetSwitch - we're still pursuing the same player
                  // Try moving toward the intermediate block
                  this._pathfindingRecursionDepth = 1;
                  const result = this._decideMovement();
                  this._pathfindingRecursionDepth = 0;
                  if (result) return result;
                }
              }
            }
          }
          
          // Fallback to normal blocking block finding
          const blockingBlock = this._findBlockingBlock(target);
          if (blockingBlock) {
            // Switch to targeting the blocking block
            this.currentTarget = blockingBlock;
            this.lastTargetSwitch = Date.now();
            // Try moving toward the block (limit recursion to prevent infinite loops)
            this._pathfindingRecursionDepth = 1;
            const result = this._decideMovement();
            this._pathfindingRecursionDepth = 0;
            if (result) return result;
          }
        }
      }
    } else if (target && !this.navigationGrid) {
      // No navigation grid - use simple direction toward target
      // If target is a block, find nearest walkable adjacent position
      let moveTarget = target;
      if (target.type === 'block') {
        const adjacentPositions = [
          { x: target.x - 1, y: target.y }, // UP
          { x: target.x + 1, y: target.y }, // DOWN
          { x: target.x, y: target.y - 1 }, // LEFT
          { x: target.x, y: target.y + 1 }, // RIGHT
        ];
        
        let closestAdjacent = null;
        let closestDistance = Infinity;
        for (const adj of adjacentPositions) {
          if (this._isValidPosition(adj) && this._isWalkable(adj)) {
            const dist = Pathfinder.manhattanDistance(this.position, adj);
            if (dist < closestDistance) {
              closestDistance = dist;
              closestAdjacent = adj;
            }
          }
        }
        
        if (closestAdjacent) {
          moveTarget = closestAdjacent;
        } else {
          return this._decideSafeExploration();
        }
      }
      
      // Coordinate system: x = row (vertical), y = col (horizontal)
      const dx = moveTarget.x - this.position.x;
      const dy = moveTarget.y - this.position.y;
      
      // Choose direction based on largest distance component
      let direction = null;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Row difference is larger - move vertically
        direction = dx > 0 ? 'DOWN' : 'UP';  // Increase row = DOWN, decrease row = UP
      } else if (dy !== 0) {
        // Col difference is larger - move horizontally
        direction = dy > 0 ? 'RIGHT' : 'LEFT';  // Increase col = RIGHT, decrease col = LEFT
      }
      
      if (direction) {
        const nextPos = this._getNextPosition(this.position, direction);
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
    // But if we have a target and just can't reach it, try to find a path-clearing block
    if (target && target.type === 'player' && !this._pathfindingRecursionDepth) {
      // Can't reach player - find a blocking block to clear
      const blockingBlock = this._findBlockingBlock(target);
      if (blockingBlock) {
        this.currentTarget = blockingBlock;
        this.lastTargetSwitch = Date.now();
        // Try moving toward the block (limit recursion to prevent infinite loops)
        this._pathfindingRecursionDepth = 1;
        const result = this._decideMovement();
        this._pathfindingRecursionDepth = 0;
        if (result) return result;
      }
    }
    
    return this._decideSafeExploration();
  }

  /**
   * Finds a block that's blocking the path to a target
   * Returns the closest block that's between NPC and target
   * @param {Object} target - Target object { x, y, type }
   * @returns {Object|null} Blocking block position { x, y } or null
   */
  _findBlockingBlock(target) {
    if (!this.gameState.board || !target) return null;
    
    // Find blocks that are in the direct path to the target
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    
    // Check blocks in the direction toward target (within 2 tiles)
    const checkDistance = Math.min(2, Math.max(Math.abs(dx), Math.abs(dy)));
    const stepX = dx !== 0 ? dx / Math.abs(dx) : 0;
    const stepY = dy !== 0 ? dy / Math.abs(dy) : 0;
    
    for (let i = 1; i <= checkDistance; i++) {
      const checkX = this.position.x + stepX * i;
      const checkY = this.position.y + stepY * i;
      
      if (this._isValidPosition({ x: checkX, y: checkY })) {
        if (this.gameState.board[checkX] && this.gameState.board[checkX][checkY] === 1) {
          // Found a blocking block
          return { x: checkX, y: checkY, type: 'block' };
        }
      }
    }
    
    // If no direct path block, find nearest block
    for (let x = Math.max(0, this.position.x - 2); x <= Math.min(this.maxRows - 1, this.position.x + 2); x++) {
      for (let y = Math.max(0, this.position.y - 2); y <= Math.min(this.maxCols - 1, this.position.y + 2); y++) {
        if (this.gameState.board[x] && this.gameState.board[x][y] === 1) {
          return { x: x, y: y, type: 'block' };
        }
      }
    }
    
    return null;
  }

  /**
   * Finds an intermediate block target in the direction toward a far-away player
   * Used by trappers to create clear waypoints when player is far away
   * @param {Object} player - Player object { x, y, id }
   * @returns {Object|null} Intermediate block position { x, y, type } or null
   */
  _findIntermediateBlockTowardPlayer(player) {
    if (!this.gameState.board || !player) return null;
    
    const dx = player.x - this.position.x;
    const dy = player.y - this.position.y;
    
    // Find blocks in the general direction toward the player (within 4-6 tiles)
    // This gives clear intermediate targets when player is far away
    const searchRadius = 5; // Search up to 5 tiles in the direction toward player
    const stepX = dx !== 0 ? dx / Math.abs(dx) : 0;
    const stepY = dy !== 0 ? dy / Math.abs(dy) : 0;
    
    // Prioritize blocks that are closer to NPC but in the direction toward player
    const candidates = [];
    
    for (let i = 2; i <= searchRadius; i++) {
      const checkX = this.position.x + stepX * i;
      const checkY = this.position.y + stepY * i;
      
      // Also check perpendicular directions (to find blocks that are "in the way")
      const perpendicularOffsets = [
        { x: 0, y: 0 },      // Direct path
        { x: stepY, y: -stepX },  // Perpendicular 1
        { x: -stepY, y: stepX },  // Perpendicular 2
      ];
      
      for (const offset of perpendicularOffsets) {
        const finalX = checkX + offset.x;
        const finalY = checkY + offset.y;
        
        if (this._isValidPosition({ x: finalX, y: finalY })) {
          if (this.gameState.board[finalX] && this.gameState.board[finalX][finalY] === 1) {
            const distance = Pathfinder.manhattanDistance(this.position, { x: finalX, y: finalY });
            const distanceToPlayer = Pathfinder.manhattanDistance({ x: finalX, y: finalY }, { x: player.x, y: player.y });
            
            // Prefer blocks that are:
            // 1. Not too close (at least 2 tiles away)
            // 2. Not too far (within 5 tiles)
            // 3. Closer to the player (clearing path toward player)
            if (distance >= 2 && distance <= 5) {
              candidates.push({
                x: finalX,
                y: finalY,
                type: 'block',
                distance: distance,
                distanceToPlayer: distanceToPlayer,
                score: distanceToPlayer - distance * 0.5 // Prefer blocks that are closer to player
              });
            }
          }
        }
      }
    }
    
    if (candidates.length === 0) {
      // Fallback: find any nearby block in the general direction
      for (let x = Math.max(0, this.position.x - 3); x <= Math.min(this.maxRows - 1, this.position.x + 3); x++) {
        for (let y = Math.max(0, this.position.y - 3); y <= Math.min(this.maxCols - 1, this.position.y + 3); y++) {
          if (this.gameState.board[x] && this.gameState.board[x][y] === 1) {
            const blockDx = x - this.position.x;
            const blockDy = y - this.position.y;
            // Check if block is in the general direction toward player (dot product check)
            const dotProduct = blockDx * dx + blockDy * dy;
            if (dotProduct > 0) { // Block is in the forward direction
              const distance = Pathfinder.manhattanDistance(this.position, { x, y });
              if (distance >= 2 && distance <= 5) {
                candidates.push({
                  x: x,
                  y: y,
                  type: 'block',
                  distance: distance,
                  distanceToPlayer: Pathfinder.manhattanDistance({ x, y }, { x: player.x, y: player.y }),
                  score: 0
                });
              }
            }
          }
        }
      }
    }
    
    if (candidates.length > 0) {
      // Sort by score (prefer blocks closer to player and in good position)
      candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return a.distance - b.distance; // If same score, prefer closer blocks
      });
      
      return candidates[0];
    }
    
    return null;
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
   * IMPORTANT: Does not check if NPC is in danger - that's handled separately
   * NPCs in danger should escape first, not be marked as stuck
   * @returns {boolean}
   */
  _isStuck() {
    // Don't mark as stuck if currently in danger - NPCs need to escape first
    // This prevents oscillation when NPCs are trying to escape
    if (this._isInDanger()) {
      return false;
    }
    
    // Don't mark as stuck if intentionally waiting (post-explosion cooldown or nearby bombs)
    // NPCs often stay in the same position when waiting for bombs to explode
    const EXPLOSION_COOLDOWN = 2500;
    const timeSinceLastExplosion = Date.now() - this.lastExplosionTime;
    const inExplosionCooldown = timeSinceLastExplosion < EXPLOSION_COOLDOWN;
    
    let hasNearbyActiveBombs = false;
    if (this.gameState && this.gameState.bombs && this.gameState.bombs.length > 0) {
      hasNearbyActiveBombs = this.gameState.bombs.some(bomb => {
        const distance = Pathfinder.manhattanDistance(this.position, { x: bomb.x, y: bomb.y });
        const range = bomb.range || 2;
        return distance <= range + 2; // Safety margin
      });
    }
    
    if (inExplosionCooldown || hasNearbyActiveBombs) {
      // Intentionally waiting - not stuck
      return false;
    }
    
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

    // Check for circular movement pattern (but only if not in danger)
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
   * IMPORTANT: Only moves to safe positions - never moves into danger zones
   * @returns {Object|null} Action object
   */
  _getUnstuck() {
    // If we're at a safe position, don't move - stay put!
    // NPCs often get "stuck" when they're safely waiting (e.g., after escaping a bomb)
    if (!this._isInDanger()) {
      // Also check if there are nearby active bombs - if so, stay put until they explode
      let hasNearbyActiveBombs = false;
      if (this.gameState && this.gameState.bombs && this.gameState.bombs.length > 0) {
        hasNearbyActiveBombs = this.gameState.bombs.some(bomb => {
          const distance = Pathfinder.manhattanDistance(this.position, { x: bomb.x, y: bomb.y });
          const range = bomb.range || 2;
          return distance <= range + 2; // Safety margin
        });
      }
      
      // Also check post-explosion cooldown
      const EXPLOSION_COOLDOWN = 2500; // Wait 2.5 seconds after explosions (matching _decideEscape)
      const timeSinceLastExplosion = Date.now() - this.lastExplosionTime;
      const inExplosionCooldown = timeSinceLastExplosion < EXPLOSION_COOLDOWN;
      
      if (!hasNearbyActiveBombs && !inExplosionCooldown) {
        // We're safe and not waiting - clear stuck state and resume normal behavior
        // Clear position history to reset stuck detection
        this.lastPositions = [];
        this.committedDirection = null;
        this.committedDirectionUntil = 0;
        this.stuckCounter = 0; // Reset stuck counter
        
        // If we don't have a target, select one now
        if (!this.currentTarget) {
          // Force target selection by clearing lastTargetSwitch
          this.lastTargetSwitch = 0;
        }
        
        // Return null to allow normal decision-making to proceed
        // The NPC will select a target and continue in the next cycle
        return null;
      } else {
        // Clear position history but stay put until bombs explode or cooldown passes
        this.lastPositions = [];
        return null;
      }
    }
    
    // Only try to get unstuck if we're actually in danger
    // Clear position history to break the loop, but keep the target if it's still valid
    // Only clear target if it's a block and we're truly stuck (can't reach it)
    if (this.currentTarget && this.currentTarget.type === 'block') {
      // If targeting a block and stuck, try switching to a different target
      this.currentTarget = null;
      this.lastTargetSwitch = Date.now();
    }
    // If targeting a player, keep the target - we'll find a way to reach them
    
    // Clear position history
    this.lastPositions = [];
    
    // Try to move in a completely different direction (but only to safe positions)
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

    // If still stuck and in danger, try any walkable direction (even if not ideal)
    // But prioritize safe positions if possible
    for (const dir of shuffled) {
      const nextPos = this._getNextPosition(this.position, dir);
      if (this._isValidPosition(nextPos) && this._isWalkable(nextPos)) {
        const nextPosInDanger = DangerDetector.isInDanger(nextPos, this.dangerZones);
        // Prefer safe positions, but if none available, take any walkable position
        if (!nextPosInDanger || shuffled.indexOf(dir) === shuffled.length - 1) {
          this.state = 'moving';
          return {
            type: 'MOVE',
            direction: dir,
          };
        }
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
    // Commit to targets for a LONG time to prevent oscillation
    // NPCs should stick to their targets even when players move
    const timeSinceSwitch = currentTime - this.lastTargetSwitch;
    const minTimeToSwitch = 30000; // 30 seconds - strong commitment to prevent oscillation
    const shouldSwitchTarget = timeSinceSwitch > minTimeToSwitch || this.currentTarget === null;

    if (!shouldSwitchTarget && this.currentTarget) {
      // Keep current target if it's still valid - stay committed to the goal
      // IMPORTANT: For players, we check if the player still exists, not exact position
      // This prevents targets from changing every time players move
      if (this._isTargetValid(this.currentTarget)) {
        // For trappers with far-away player targets, prioritize intermediate block targets
        if (this.currentTarget.type === 'player' && this.strategy.name === 'trapper' && this.gameState.players) {
          const player = this.gameState.players.find(p => 
            p.id !== this.id && 
            p.alive !== false && 
            (p.id === this.currentTarget.playerId || 
             (Math.abs(p.x - this.currentTarget.x) <= 2 && Math.abs(p.y - this.currentTarget.y) <= 2))
          );
          if (player) {
            const distance = Pathfinder.manhattanDistance(this.position, { x: player.x, y: player.y });
            const chaseDistance = this.strategy.chaseDistance || 3;
            
            // If player is far away, find intermediate block targets in the direction toward player
            if (distance > chaseDistance + 2) {
              const intermediateBlock = this._findIntermediateBlockTowardPlayer(player);
              if (intermediateBlock) {
                // Switch to intermediate block target (but don't reset lastTargetSwitch - we're still pursuing the same player)
                this.currentTarget = intermediateBlock;
                this.currentTarget.intermediateForPlayer = player.id; // Track that this is intermediate
                return this.currentTarget;
              }
            }
            
            // Only update player position if they've moved significantly (more than 3 tiles)
            // This prevents constant pathfinding recalculation
            const distanceFromStoredPosition = Pathfinder.manhattanDistance(
              { x: this.currentTarget.x, y: this.currentTarget.y },
              { x: player.x, y: player.y }
            );
            if (distanceFromStoredPosition > 3) {
              this.currentTarget.x = player.x;
              this.currentTarget.y = player.y;
            }
            if (player.id) this.currentTarget.playerId = player.id;
            return this.currentTarget;
          }
        }
        
        // Update target position if it's a player (they move, but we keep targeting them)
        if (this.currentTarget.type === 'player' && this.gameState.players) {
          const player = this.gameState.players.find(p => 
            p.id !== this.id && 
            p.alive !== false && 
            // Match by player ID if available, or by approximate position
            (p.id === this.currentTarget.playerId || 
             (Math.abs(p.x - this.currentTarget.x) <= 1 && Math.abs(p.y - this.currentTarget.y) <= 1))
          );
          if (player) {
            // Only update target position if player has moved significantly (more than 3 tiles)
            // This prevents constant pathfinding recalculation
            const distanceFromStoredPosition = Pathfinder.manhattanDistance(
              { x: this.currentTarget.x, y: this.currentTarget.y },
              { x: player.x, y: player.y }
            );
            if (distanceFromStoredPosition > 3) {
              this.currentTarget.x = player.x;
              this.currentTarget.y = player.y;
            }
            if (player.id) this.currentTarget.playerId = player.id;
            return this.currentTarget;
          }
        }
        return this.currentTarget;
      }
    }

    const candidates = [];

    // PRIORITY 1: Find player targets - ALWAYS prioritize players if they exist
    // NPCs should always have a target if players are visible (anywhere on the board)
    // IMPORTANT: Prioritize human players over NPCs
    if (this.strategy.targetPriority.players > 0.3 && this.gameState.players) {
      // First, collect human players (priority targets)
      const humanPlayers = [];
      const npcPlayers = [];
      
      this.gameState.players.forEach(player => {
        if (player.id !== this.id && player.alive !== false) {
          if (player.isNPC === false || player.isNPC === undefined) {
            // Human player - highest priority
            humanPlayers.push(player);
          } else {
            // NPC player - lower priority
            npcPlayers.push(player);
          }
        }
      });
      
      // Add human players first (with higher priority boost)
      humanPlayers.forEach(player => {
        const distance = Pathfinder.manhattanDistance(this.position, { x: player.x, y: player.y });
        const hasRoute = this._hasRouteToTarget({ x: player.x, y: player.y, type: 'player' });
        
        candidates.push({
          x: player.x,
          y: player.y,
          type: 'player',
          priority: this.strategy.targetPriority.players * 2.0, // 2x boost for human players
          distance: distance,
          playerId: player.id,
          hasRoute: hasRoute,
          isHuman: true, // Mark as human player
        });
      });
      
      // Add NPC players only if no human players exist (or if very close)
      if (humanPlayers.length === 0) {
        npcPlayers.forEach(player => {
          const distance = Pathfinder.manhattanDistance(this.position, { x: player.x, y: player.y });
          const hasRoute = this._hasRouteToTarget({ x: player.x, y: player.y, type: 'player' });
          
          candidates.push({
            x: player.x,
            y: player.y,
            type: 'player',
            priority: this.strategy.targetPriority.players * 0.5, // Lower priority for NPCs
            distance: distance,
            playerId: player.id,
            hasRoute: hasRoute,
            isHuman: false, // Mark as NPC
          });
        });
      }
    }

    // PRIORITY 2: Find powerup targets (secondary to players)
    // Only consider powerups if no players are available, or if very close
    if (this.strategy.targetPriority.powerups > 0.3 && this.gameState.powerups) {
      const hasPlayerTargets = candidates.some(c => c.type === 'player');
      
      this.gameState.powerups.forEach(powerup => {
        const distance = Pathfinder.manhattanDistance(this.position, { x: powerup.x, y: powerup.y });
        // Check if route exists to this powerup
        const hasRoute = this._hasRouteToTarget({ x: powerup.x, y: powerup.y, type: 'powerup' });
        
        // Only include powerups if no players available, or if very close (within 3 tiles)
        if (!hasPlayerTargets || distance <= 3) {
          candidates.push({
            x: powerup.x,
            y: powerup.y,
            type: 'powerup',
            priority: this.strategy.targetPriority.powerups,
            distance: distance,
            hasRoute: hasRoute,
          });
        }
      });
    }

    // Find block targets - blocks are obstacles that need to be cleared to reach players
    // Always look for nearby blocks, even if players exist (blocks block the path!)
    if (this.strategy.targetPriority.blocks > 0.3 && this.gameState.board) {
      // Find nearby blocks that might be blocking the path to players
      for (let x = Math.max(0, this.position.x - 3); x <= Math.min(this.maxRows - 1, this.position.x + 3); x++) {
        for (let y = Math.max(0, this.position.y - 3); y <= Math.min(this.maxCols - 1, this.position.y + 3); y++) {
          // Grid is structured as grid[row][col], and x=row, y=col
          if (this.gameState.board[x] && this.gameState.board[x][y] === 1) { // Destructible block
            const distance = Pathfinder.manhattanDistance(this.position, { x, y });
            if (distance <= 3) { // Only nearby blocks (within 3 tiles)
              candidates.push({
                x: x,
                y: y,
                type: 'block',
                priority: this.strategy.targetPriority.blocks * 0.5, // Lower priority than players/powerups
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

    // Score candidates with strategic priorities:
    // 1. Players are highest priority (attack enemies) - ALWAYS prioritize over everything
    // 2. Powerups are secondary priority (get upgrades)
    // 3. Blocks are lowest priority (only clear if blocking path or no other targets)
    // Also consider route availability - prefer targets we can actually reach
    candidates.forEach(candidate => {
      let score = candidate.priority * (10 / (candidate.distance + 1));
      
      // STRATEGIC PRIORITY BOOSTS:
      // Players are ALWAYS highest priority - NPCs should hunt players
      if (candidate.type === 'player') {
        // Human players get even higher priority than NPCs
        if (candidate.isHuman === true) {
          score *= 5.0; // Very strongly prioritize human players
        } else {
          score *= 2.0; // Lower priority for NPC players (only if no humans available)
        }
      }
      // Powerups are secondary priority
      else if (candidate.type === 'powerup') {
        score *= 1.5; // Moderate boost for powerups
      }
      // Blocks only if they're blocking path to players or no players available
      // Don't boost blocks - they're just obstacles to clear
      
      // Route availability bonus: prefer targets we can actually reach
      if (candidate.hasRoute) {
        score *= 1.2; // 20% bonus for reachable targets
      } else {
        score *= 0.5; // Penalty for unreachable targets (but don't exclude them completely)
      }
      
      candidate.score = score;
    });

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    // Always select the best target (no randomness) - NPCs should be strategic, not random
    const selected = candidates[0];

    this.currentTarget = selected;
    this.lastTargetSwitch = currentTime;
    this.hasClearedTargetAfterEscape = false; // Reset flag when selecting a new target

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
        // For players, check if the player still exists and is alive
        // Don't check exact position - players move, but we keep targeting them
        if (target.playerId) {
          // If we have a player ID, match by ID
          const player = this.gameState.players.find(p => p.id === target.playerId);
          return player && player.alive !== false;
        } else {
          // Fallback: check if any player is near the target position (within 2 tiles)
          // This handles cases where player ID wasn't stored
          return this.gameState.players.some(p => 
            p.id !== this.id && 
            p.alive !== false &&
            Math.abs(p.x - target.x) <= 2 && 
            Math.abs(p.y - target.y) <= 2
          );
        }
      case 'powerup':
        return this.gameState.powerups && 
               this.gameState.powerups.some(p => p.x === target.x && p.y === target.y);
      case 'block':
        // If this is an intermediate block for a player, check if player still exists
        if (target.intermediateForPlayer) {
          const player = this.gameState.players.find(p => p.id === target.intermediateForPlayer);
          if (!player || player.alive === false) {
            return false; // Player is gone, intermediate block is no longer valid
          }
          
          // Check if block still exists
          const blockExists = this.gameState.board && 
                             this.gameState.board[target.x] && 
                             this.gameState.board[target.x][target.y] === 1;
          
          if (!blockExists) {
            // Block was destroyed - find next intermediate block toward player
            // This prevents oscillation by immediately finding the next waypoint
            const nextIntermediate = this._findIntermediateBlockTowardPlayer(player);
            if (nextIntermediate) {
              this.currentTarget = nextIntermediate;
              this.currentTarget.intermediateForPlayer = player.id;
              return true; // New intermediate target is valid
            } else {
              // No more intermediate blocks - switch back to player target
              this.currentTarget = {
                x: player.x,
                y: player.y,
                type: 'player',
                playerId: player.id
              };
              return true; // Player target is valid
            }
          }
          
          // Block still exists and we're moving toward it
          return true;
        }
        return this.gameState.board && 
               this.gameState.board[target.x] && 
               // Grid is structured as grid[row][col], and x=row, y=col
               this.gameState.board[target.x][target.y] === 1;
      default:
        return false;
    }
  }

  /**
   * Checks if there's a route to a target (pathfinding check)
   * @param {Object} target - Target object { x, y, type }
   * @returns {boolean}
   */
  _hasRouteToTarget(target) {
    if (!this.navigationGrid || !target) {
      return true; // Assume reachable if no grid (fallback)
    }

    // Try to find a path to the target
    const path = Pathfinder.findPath(
      this.position,
      { x: target.x, y: target.y },
      this.navigationGrid,
      this.maxRows,
      this.maxCols
    );

    return path !== null && path.length > 0;
  }

  /**
   * Checks if the current plan is still valid
   * @param {Object} plan - Plan object
   * @returns {boolean}
   */
  _isPlanValid(plan) {
    if (!plan) return false;
    
    // If in danger, escape plans take priority
    if (this._isInDanger() && plan.type !== 'ESCAPE') {
      return false;
    }
    
    // Check if the next step in the plan is still valid
    if (plan.type === 'MOVE') {
      const nextPos = this._getNextPosition(this.position, plan.direction);
      if (!this._isValidPosition(nextPos) || !this._isWalkable(nextPos)) {
        return false;
      }
      // Don't move into danger unless escaping
      if (DangerDetector.isInDanger(nextPos, this.dangerZones) && !this._isInDanger()) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Executes one step of the current plan
   * @param {Object} plan - Plan object
   * @returns {Object|null} Action object or null
   */
  _executePlanStep(plan) {
    if (!plan || plan.stepsRemaining <= 0) {
      return null;
    }
    
    if (plan.type === 'MOVE') {
      const nextPos = this._getNextPosition(this.position, plan.direction);
      if (this._isValidPosition(nextPos) && this._isWalkable(nextPos)) {
        // CRITICAL: Always check for danger before moving
        // Only allow moving into danger if we're currently in danger and trying to escape
        const nextPosInDanger = DangerDetector.isInDanger(nextPos, this.dangerZones);
        const currentlyInDanger = this._isInDanger();
        
        // Never move into danger unless we're already in danger and escaping
        if (!nextPosInDanger || (currentlyInDanger && this.state === 'escaping')) {
          return {
            type: 'MOVE',
            direction: plan.direction,
          };
        } else {
          // Plan step would move into danger - cancel plan and escape instead
          this.currentPlan = null;
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * Calculates how many steps to plan ahead (human-like commitment)
   * @param {Object} decision - Decision object
   * @param {Object} perception - Perception object
   * @returns {number} Number of steps to plan
   */
  _calculatePlanSteps(decision, perception) {
    if (decision.type !== 'MOVE') {
      return 0; // Only plan movement steps
    }
    
    // Humans commit to movement for several steps
    // More steps if:
    // - Moving toward a clear target
    // - Not in danger
    // - Has momentum (already moving in this direction)
    
    let steps = 1; // Minimum 1 step
    
    if (this.currentTarget) {
      // Moving toward a target - commit for more steps
      const distance = Pathfinder.manhattanDistance(this.position, this.currentTarget);
      if (distance > 3) {
        steps = 3; // Far target - commit to 3 steps
      } else if (distance > 1) {
        steps = 2; // Medium distance - commit to 2 steps
      }
    }
    
    // Momentum bonus - if already moving in this direction, continue longer
    if (this.movementMomentum > 0 && decision.direction === this.lastMovementDirection) {
      steps += Math.min(2, this.movementMomentum); // Up to 2 extra steps for momentum
    }
    
    // Reduce steps if in danger (humans are more cautious)
    if (perception.inDanger) {
      steps = Math.min(steps, 1); // Only 1 step when in danger
    }
    
    return Math.min(steps, 5); // Cap at 5 steps (humans don't plan too far ahead)
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
    this.lives = 3;
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

